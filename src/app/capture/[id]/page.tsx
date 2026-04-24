"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Camera, CheckCircle2, Loader2, AlertTriangle, ShieldCheck, Lock } from "lucide-react"
import { FaceCamera } from "@/components/ui/FaceCamera"
import { formatCpf } from "@/utils/cpf"

export default function RemoteCapturePage() {
  const params = useParams()
  const employeeId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employee, setEmployee] = useState<{id: string, full_name: string, cpf: string, photo_url: string | null} | null>(null)
  
  // Verificação de CPF
  const [cpfInput, setCpfInput] = useState("")
  const [cpfVerified, setCpfVerified] = useState(false)
  const [cpfError, setCpfError] = useState("")

  const [isCapturing, setIsCapturing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    async function loadEmployee() {
      try {
        const res = await fetch(`/api/remote-capture?id=${employeeId}`)
        if (!res.ok) {
          throw new Error("Colaborador não encontrado ou erro na requisição.")
        }
        const data = await res.json()
        setEmployee(data)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError("Erro desconhecido.")
        }
      } finally {
        setLoading(false)
      }
    }
    
    if (employeeId) {
      loadEmployee()
    }
  }, [employeeId])

  const handleCpfVerify = () => {
    if (!employee) return
    setCpfError("")
    // Remove formatação para comparar apenas os dígitos
    const inputDigits = cpfInput.replace(/\D/g, '')
    const employeeDigits = employee.cpf.replace(/\D/g, '')
    
    if (inputDigits.length < 11) {
      setCpfError("Digite o CPF completo (11 dígitos).")
      return
    }

    if (inputDigits === employeeDigits) {
      setCpfVerified(true)
    } else {
      setCpfError("CPF não confere com o cadastro. Verifique e tente novamente.")
    }
  }

  const handleCapture = async (face_descriptor: Float32Array, photo_url: string) => {
    setIsCapturing(false)
    setIsSaving(true)
    
    // Scroll para o topo para mostrar o resultado
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    try {
      const res = await fetch('/api/remote-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: employeeId,
          photo_url,
          face_descriptor: Array.from(face_descriptor)
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erro ao salvar a biometria.")
      }

      setIsSuccess(true)
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert("Falha: " + err.message)
      } else {
        alert("Falha ao salvar biometria.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B1A1A]" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Erro no Link</h1>
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 animate-in fade-in zoom-in duration-500">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-2 text-center">Biometria Salva!</h1>
        <p className="text-slate-500 text-center max-w-sm mb-8">
          Sua foto foi registrada com sucesso no sistema. Você já pode fechar esta tela.
        </p>
      </div>
    )
  }

  // ── TELA DE CAPTURA (fullscreen mobile-friendly) ──
  if (isCapturing) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50">
        <div className="flex items-center justify-between p-3 bg-black/80 z-10">
          <h3 className="text-white font-black uppercase text-xs tracking-widest">Captura Facial</h3>
          <button onClick={() => setIsCapturing(false)} className="text-white text-xs font-bold bg-white/20 px-3 py-1.5 rounded-full">Cancelar</button>
        </div>
        <div className="flex-1 min-h-0">
           <FaceCamera 
              onCapture={handleCapture}
              onCancel={() => setIsCapturing(false)}
              cancelLabel="Cancelar"
           />
        </div>
      </div>
    )
  }

  // ── TELA DE VERIFICAÇÃO DE CPF ──
  if (!cpfVerified) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7 text-[#8B1A1A]" />
          </div>
          
          <div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Verificação de Identidade</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Antares SESMT Digital</p>
          </div>

          <p className="text-sm text-slate-500">
            Para sua segurança, informe o CPF do colaborador para confirmar sua identidade antes da captura.
          </p>

          <div className="space-y-3">
            <input 
              type="text"
              value={cpfInput}
              onChange={(e) => { setCpfInput(formatCpf(e.target.value)); setCpfError(""); }}
              placeholder="000.000.000-00"
              maxLength={14}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-center text-lg font-bold focus:border-[#8B1A1A] focus:outline-none transition-all tracking-widest"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCpfVerify()}
            />
            
            {cpfError && (
              <p className="text-red-500 text-xs font-bold animate-in fade-in">{cpfError}</p>
            )}

            <button 
              onClick={handleCpfVerify}
              className="w-full bg-[#8B1A1A] hover:bg-[#681313] text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-900/20 border-b-4 border-red-900 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Verificar CPF
            </button>
          </div>

          <p className="text-[9px] text-slate-400 italic">
            O CPF é necessário para confirmar que o link está sendo usado pela pessoa correta.
          </p>
        </div>
      </div>
    )
  }

  // ── TELA PRINCIPAL (CPF já verificado) ──
  return (
    <div className="min-h-screen bg-slate-50 p-4 flex flex-col items-center justify-center">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Camera className="w-7 h-7 text-green-600" />
        </div>
        
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Cadastro de Biometria</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Antares SESMT Digital</p>
        </div>

        <div className="bg-green-50 p-3 rounded-xl border border-green-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="text-left">
            <p className="text-[10px] text-green-700 font-bold uppercase tracking-widest">Identidade Confirmada</p>
            <p className="font-black text-green-900 text-sm">{employee.full_name}</p>
          </div>
        </div>

        {employee.photo_url && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] text-orange-500 font-bold uppercase tracking-widest flex items-center gap-1 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
              <AlertTriangle className="w-3 h-3" /> Você já possui biometria
            </div>
            <p className="text-xs text-slate-500">Fazer uma nova captura irá substituir sua foto atual.</p>
          </div>
        )}

        <button 
          onClick={() => setIsCapturing(true)}
          disabled={isSaving}
          className="w-full bg-[#8B1A1A] hover:bg-[#681313] text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-red-900/20 border-b-4 border-red-900 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
          ) : (
            <><Camera className="w-5 h-5" /> Iniciar Câmera</>
          )}
        </button>

        <p className="text-[9px] text-slate-400 italic">
          Certifique-se de estar em um local bem iluminado e retire óculos escuros ou bonés.
        </p>
      </div>
    </div>
  )
}
