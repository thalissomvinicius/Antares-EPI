import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // Inicializa o cliente DENTRO da função para evitar erros de build na Vercel 
    // se a variável de ambiente não estiver disponível durante a compilação estática.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Variáveis de ambiente do Supabase ausentes no servidor.");
      return NextResponse.json({ error: "Configuração do servidor incompleta" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const formData = await req.formData();
    
    const employee_id = formData.get('employee_id') as string;
    const ppe_id = formData.get('ppe_id') as string;
    const workplace_id = formData.get('workplace_id') as string | null;
    const reason = formData.get('reason') as string;
    const quantity = parseInt(formData.get('quantity') as string || '1');
    const ip_address = formData.get('ip_address') as string;
    const auth_method = formData.get('auth_method') as string || 'manual';
    const signatureFile = formData.get('signatureFile') as File | null;
    const token = formData.get('token') as string | null;

    if (!employee_id || !ppe_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Validação de Token se fornecido
    if (token) {
      const { data: link, error: linkError } = await supabaseAdmin
        .from('remote_links')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (linkError || !link) {
        return NextResponse.json({ error: 'Este link já foi utilizado ou é inválido.' }, { status: 403 })
      }

      if (new Date(link.expires_at) < new Date()) {
        await supabaseAdmin.from('remote_links').update({ status: 'expired' }).eq('id', link.id)
        return NextResponse.json({ error: 'Este link expirou.' }, { status: 403 })
      }
    }

    let signatureUrl = null;

    // 1. Upload da assinatura usando a chave de Admin
    if (signatureFile && signatureFile.size > 0) {
      // Prefix filename with auth method to distinguish in history
      const prefix = auth_method === 'facial' ? 'bio_' : 'sig_';
      const fileName = `${prefix}${Date.now()}_${employee_id}.png`;
      const { error: storageError } = await supabaseAdmin.storage
        .from('ppe_signatures')
        .upload(fileName, signatureFile);
      
      if (storageError) {
        console.error("Storage upload error:", storageError);
        throw new Error("Erro ao fazer upload da assinatura no Storage");
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('ppe_signatures')
        .getPublicUrl(fileName);
      
      signatureUrl = publicUrl;
    }

    const { data: beforeStockData, error: beforeStockError } = await supabaseAdmin
      .from('ppes')
      .select('current_stock')
      .eq('id', ppe_id)
      .maybeSingle();
    if (beforeStockError) throw beforeStockError;
    const stockBeforeRaw = (beforeStockData as { current_stock?: number | string } | null)?.current_stock;
    const stockBefore =
      typeof stockBeforeRaw === 'number'
        ? stockBeforeRaw
        : typeof stockBeforeRaw === 'string' && Number.isFinite(Number(stockBeforeRaw))
          ? Number(stockBeforeRaw)
          : null;

    // 2. Insere a entrega no banco usando a chave de Admin
    const { data, error } = await supabaseAdmin
      .from('deliveries')
      .insert([{
        employee_id,
        ppe_id,
        workplace_id: workplace_id === 'null' || !workplace_id ? null : workplace_id,
        reason,
        quantity,
        ip_address,
        signature_url: signatureUrl,
        auth_method, // Assuming the column will be added
        delivery_date: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error("Database insert error:", error);
      throw error;
    }

    const { data: afterStockData, error: afterStockError } = await supabaseAdmin
      .from('ppes')
      .select('current_stock')
      .eq('id', ppe_id)
      .maybeSingle();
    if (afterStockError) throw afterStockError;
    const stockAfterRaw = (afterStockData as { current_stock?: number | string } | null)?.current_stock;
    const stockAfterInsert =
      typeof stockAfterRaw === 'number'
        ? stockAfterRaw
        : typeof stockAfterRaw === 'string' && Number.isFinite(Number(stockAfterRaw))
          ? Number(stockAfterRaw)
          : null;

    const desiredStock = stockBefore === null ? null : Math.max(0, stockBefore - quantity);
    if (desiredStock !== null && stockAfterInsert !== null && stockAfterInsert > desiredStock) {
      const missingOut = stockAfterInsert - desiredStock;
      const movementPayload = {
        ppe_id,
        quantity: missingOut,
        type: 'SAIDA',
        motive: `Entrega remota (${reason})`,
        created_by_name: 'Sistema (Entrega Remota)',
      };
      const { error: movementError } = await supabaseAdmin
        .from('stock_movements')
        .insert([movementPayload]);

      if (movementError) {
        const text = `${movementError.message || ''} ${movementError.details || ''}`.toLowerCase();
        const missingCreatedByColumns =
          movementError.code === 'PGRST204' ||
          movementError.code === '42703' ||
          text.includes('created_by_name') ||
          text.includes('created_by_id');

        if (!missingCreatedByColumns) throw movementError;

        const { error: fallbackError } = await supabaseAdmin
          .from('stock_movements')
          .insert([{
            ppe_id,
            quantity: missingOut,
            type: 'SAIDA',
            motive: `Entrega remota (${reason})`,
          }]);

        if (fallbackError) throw fallbackError;
      }
    }

    // 3. Marca link como concluído se existir
    if (token) {
      await supabaseAdmin
        .from('remote_links')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('token', token)
    }
    
    return NextResponse.json({ success: true, data: data[0] });

  } catch (error: unknown) {
    console.error('Remote delivery save error:', error);
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
