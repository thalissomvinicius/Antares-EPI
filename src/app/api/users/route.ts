import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Usamos a chave Service Role para poder criar usuários sem deslogar o admin atual
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Buscar os perfis da tabela profiles para complementar
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')

    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 400 })
    }

    // Mesclar os dados de auth com os perfis
    const mergedUsers = users.users.map(u => {
      const profile = profiles?.find(p => p.id === u.id)
      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name || '',
        role: profile?.role || 'USER',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at
      }
    })

    return NextResponse.json({ users: mergedUsers })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json()

    // 1. Criar o usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirma o email
      user_metadata: { full_name }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Criar ou atualizar o profile
    if (authData.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email,
          full_name,
          role
        })

      if (profileError) {
        // Fallback: se der erro no profile, exclui o user do Auth pra não ficar órfão
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, user: authData.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, password, role, full_name } = await request.json()

    // 1. Atualizar senha (se informada) e metadados no Auth
    const updates: any = {}
    if (password) updates.password = password
    if (full_name) updates.user_metadata = { full_name }

    if (Object.keys(updates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updates)
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // 2. Atualizar role e full_name no Profiles
    const profileUpdates: any = {}
    if (role) profileUpdates.role = role
    if (full_name) profileUpdates.full_name = full_name

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', id)

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
