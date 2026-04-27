"use client"

import { useState, useEffect } from "react"
import { ArrowRightLeft, Search, Calendar, Filter, FileSpreadsheet, Loader2, ArrowUpRight, ArrowDownLeft, Shield, Users } from "lucide-react"
import { api } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { format, startOfMonth, endOfMonth, subDays, isWithinInterval } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DeliveryWithRelations } from "@/types/database"
import { exportDeliveriesToExcel } from "@/utils/excelExporter"

type DateFilter = 'all' | 'month' | 'last30' | 'last60' | 'last90' | 'custom' | 'specific_month'

export default function MovementsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [rawDeliveries, setRawDeliveries] = useState<DeliveryWithRelations[]>([])
  
  // Filter State
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [specificMonth, setSpecificMonth] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState("")

  // Auth protection
  useEffect(() => {
    if (!authLoading && user && user.role === 'ALMOXARIFE') {
      router.push('/')
    }
  }, [user, authLoading, router])

  // Load Data
  useEffect(() => {
    async function loadData() {
      if (!user || user.role === 'ALMOXARIFE') return
      try {
        setLoading(true)
        const data = await api.getDeliveries()
        setRawDeliveries(data)
      } catch (err) {
        console.error("Erro ao carregar movimentações:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user])

  // Filter Logic
  const getFilteredData = () => {
    let filtered = rawDeliveries
    const now = new Date()

    if (dateFilter !== 'all') {
      let start: Date | null = null
      let end: Date = now

      if (dateFilter === 'month') {
        start = startOfMonth(now)
        end = endOfMonth(now)
      } else if (dateFilter === 'last30') {
        start = subDays(now, 30)
      } else if (dateFilter === 'last60') {
        start = subDays(now, 60)
      } else if (dateFilter === 'last90') {
        start = subDays(now, 90)
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        start = new Date(customStartDate)
        end = new Date(customEndDate + 'T23:59:59')
      } else if (dateFilter === 'specific_month' && specificMonth) {
        start = new Date(specificMonth + '-01T00:00:00')
        end = endOfMonth(start)
      }

      if (start) {
        filtered = filtered.filter(d => {
          const dDate = new Date(d.delivery_date)
          return isWithinInterval(dDate, { start, end })
        })
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(d => 
        d.employee?.full_name.toLowerCase().includes(lower) ||
        d.ppe?.name.toLowerCase().includes(lower) ||
        d.employee?.cpf.includes(searchTerm)
      )
    }

    return filtered.sort((a, b) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime())
  }

  const filteredMovements = getFilteredData()
  
  const stats = {
    deliveries: filteredMovements.filter(m => !m.returned_at).length,
    returns: filteredMovements.filter(m => m.returned_at).length,
    totalItems: filteredMovements.reduce((acc, m) => acc + m.quantity, 0),
    uniqueEmployees: new Set(filteredMovements.map(m => m.employee_id)).size
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-800 flex items-center uppercase">
            <ArrowRightLeft className="w-6 h-6 mr-2 text-[#8B1A1A]" />
            Movimentações Mensais
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Monitoramento completo de entradas e saídas por período.</p>
        </div>
        
        <button
          onClick={() => exportDeliveriesToExcel(filteredMovements)}
          className="w-full md:w-auto bg-[#1e293b] hover:bg-slate-800 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar Planilha
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 space-y-2 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> Período
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: 'month', label: 'Mês Atual' },
                { id: 'last30', label: '30 Dias' },
                { id: 'last90', label: '90 Dias' },
                { id: 'all', label: 'Tudo' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setDateFilter(opt.id as DateFilter)}
                  className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                    dateFilter === opt.id 
                      ? "bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-md shadow-red-900/20" 
                      : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-2 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
              <Filter className="w-3 h-3 mr-1" /> Outros Filtros
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDateFilter('specific_month')}
                className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  dateFilter === 'specific_month' 
                    ? "bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-md shadow-red-900/20" 
                    : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300"
                }`}
              >
                Mês Específico
              </button>
              <button
                onClick={() => setDateFilter('custom')}
                className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                  dateFilter === 'custom' 
                    ? "bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-md shadow-red-900/20" 
                    : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-white hover:border-slate-300"
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
              <Search className="w-3 h-3 mr-1" /> Pesquisar
            </label>
            <input
              type="text"
              placeholder="Nome, CPF ou EPI..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#8B1A1A] outline-none transition-all"
            />
          </div>
        </div>

        {/* Custom Inputs */}
        {dateFilter === 'specific_month' && (
          <div className="pt-4 border-t border-slate-50 animate-in slide-in-from-top-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Selecione o Mês</label>
            <input
              type="month"
              value={specificMonth}
              onChange={e => setSpecificMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#8B1A1A] outline-none"
            />
          </div>
        )}

        {dateFilter === 'custom' && (
          <div className="pt-4 border-t border-slate-50 flex gap-4 animate-in slide-in-from-top-2">
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Início</label>
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#8B1A1A] outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fim</label>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:border-[#8B1A1A] outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Entregas", value: stats.deliveries, icon: ArrowUpRight, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Devoluções", value: stats.returns, icon: ArrowDownLeft, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Itens Movimentados", value: stats.totalItems, icon: Shield, color: "text-[#8B1A1A]", bg: "bg-red-50" },
          { label: "Pessoas Atendidas", value: stats.uniqueEmployees, icon: Users, color: "text-slate-600", bg: "bg-slate-50" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-xl font-black text-slate-800 tracking-tighter mt-0.5">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#8B1A1A]" />
              <p className="text-sm font-black uppercase tracking-widest italic">Acessando Banco de Dados...</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-slate-400 bg-slate-50/50 uppercase tracking-[0.2em] border-b border-slate-100 font-black">
                <tr>
                  <th className="px-6 py-5">Data / Hora</th>
                  <th className="px-6 py-5">Colaborador</th>
                  <th className="px-6 py-5">EPI / CA</th>
                  <th className="px-6 py-5 text-center">Qtd</th>
                  <th className="px-6 py-5 text-center">Tipo</th>
                  <th className="px-6 py-5">Unidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredMovements.map((move, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{format(new Date(move.delivery_date), "dd/MM/yyyy")}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{format(new Date(move.delivery_date), "HH:mm")}h</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 uppercase tracking-tighter">{move.employee?.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-bold tracking-widest">{move.employee?.cpf}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-600">{move.ppe?.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase">C.A. {move.ppe?.ca_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-xs">
                        {move.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {move.returned_at ? (
                        <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center">
                          <ArrowDownLeft className="w-3 h-3 mr-1" /> Devolução
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center">
                          <ArrowUpRight className="w-3 h-3 mr-1" /> Entrega
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px] block">
                        {move.workplace?.name || "Geral"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">
                      <ArrowRightLeft className="w-10 h-10 mx-auto mb-4 opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest">Nenhuma movimentação neste período.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
