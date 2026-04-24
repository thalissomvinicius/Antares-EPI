import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Cliente Supabase com service_role_key — contorna RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates, removePhoto } = body

    if (!id) {
      return NextResponse.json({ error: 'ID do colaborador é obrigatório' }, { status: 400 })
    }

    // Se é uma operação de remoção de foto, faz uma chamada dedicada
    if (removePhoto) {
      const { data, error } = await supabaseAdmin
        .from('employees')
        .update({ photo_url: null, face_descriptor: null })
        .eq('id', id)
        .select()

      if (error) {
        console.error('[API employees/update] Remove photo error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('[API employees/update] Photo removed. Result:', data)
      return NextResponse.json({ employee: data?.[0] || null })
    }

    // Atualização genérica de campos
    if (updates && Object.keys(updates).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()

      if (error) {
        console.error('[API employees/update] Update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('[API employees/update] Updated. Result count:', data?.length)
      return NextResponse.json({ employee: data?.[0] || null })
    }

    return NextResponse.json({ error: 'Nenhuma atualização fornecida' }, { status: 400 })
  } catch (err) {
    console.error('[API employees/update] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
