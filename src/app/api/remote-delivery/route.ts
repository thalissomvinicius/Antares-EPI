import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usamos o Service Role Key para ignorar o RLS do Supabase, 
// pois esta rota é chamada por usuários públicos (sem sessão).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const employee_id = formData.get('employee_id') as string;
    const ppe_id = formData.get('ppe_id') as string;
    const workplace_id = formData.get('workplace_id') as string | null;
    const reason = formData.get('reason') as string;
    const quantity = parseInt(formData.get('quantity') as string || '1');
    const ip_address = formData.get('ip_address') as string;
    const signatureFile = formData.get('signatureFile') as File | null;

    if (!employee_id || !ppe_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    let signatureUrl = null;

    // 1. Upload da assinatura usando a chave de Admin
    if (signatureFile && signatureFile.size > 0) {
      const fileName = `${Date.now()}_${employee_id}.png`;
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
        delivery_date: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error("Database insert error:", error);
      throw error;
    }
    
    return NextResponse.json({ success: true, data: data[0] });

  } catch (err: any) {
    console.error('Remote delivery save error:', err);
    return NextResponse.json({ error: err.message || "Erro interno do servidor" }, { status: 500 });
  }
}
