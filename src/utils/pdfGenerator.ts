import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { COMPANY_CONFIG } from "@/config/company"
import QRCode from "qrcode"
import { DeliveryWithRelations } from "@/types/database"

const [r, g, b] = COMPANY_CONFIG.primaryColorRgb

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

function addPageHeader(doc: jsPDF, title: string, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Background bar
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pageWidth, 38, "F")

  // White accent line
  doc.setFillColor(r + 30, g + 30, b + 30)
  doc.rect(0, 34, pageWidth, 4, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.text(COMPANY_CONFIG.name.toUpperCase(), 14, 13)

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(title, pageWidth / 2, 22, { align: "center" })

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text(subtitle, pageWidth / 2, 30, { align: "center" })

  doc.setFontSize(7)
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageWidth - 14, 13, { align: "right" })

  doc.setTextColor(30, 41, 59)
}

function addPageFooter(doc: jsPDF, hash?: string, ip?: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFillColor(248, 250, 252)
  doc.rect(0, pageHeight - 16, pageWidth, 16, "F")

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16)

  doc.setFontSize(6)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 116, 139)

  const left = `${COMPANY_CONFIG.systemName} • NR-06 Compliance • Identidade Digital Verificada`
  const right = hash ? `Hash: ${hash} | IP: ${ip || 'N/A'}` : `Emitido em ${format(new Date(), "dd/MM/yyyy")}`
  doc.text(left, 14, pageHeight - 6)
  doc.text(right, pageWidth - 14, pageHeight - 6, { align: "right" })
}

function infoRow(doc: jsPDF, label: string, value: string, x: number, y: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(label.toUpperCase(), x, y)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text(value || "—", x, y + 5)
}

// ─────────────────────────────────────────────
// 1. FICHA DE ENTREGA (NR-06) - MODERN LAYOUT
// ─────────────────────────────────────────────

export interface DeliveryPDFData {
  employeeName: string
  employeeCpf: string
  employeeRole: string
  workplaceName: string
  // Single item (backward compat)
  ppeName?: string
  ppeCaNumber?: string
  ppeCaExpiry?: string
  quantity?: number
  reason?: string
  // Multi-item support
  items?: { ppeName: string; ppeCaNumber: string; caExpiry?: string; quantity: number; reason: string }[]
  authMethod: 'manual' | 'facial'
  signatureBase64: string
  photoBase64?: string
  ipAddress?: string
  location?: string
  validationHash?: string
  deliveryDate?: string // Custom delivery date
}

export async function generateDeliveryPDF(data: DeliveryPDFData): Promise<Blob> {
  const doc = new jsPDF({ format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const hash = data.validationHash || Math.random().toString(36).substring(2, 12).toUpperCase()

  // Build items array (support both single and multi-item)
  const pdfItems = data.items && data.items.length > 0
    ? data.items
    : [{ ppeName: data.ppeName || "", ppeCaNumber: data.ppeCaNumber || "", caExpiry: data.ppeCaExpiry, quantity: data.quantity || 0, reason: data.reason || "" }]

  // 1. HEADER (SaaS Premium Style)
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pageWidth, 40, "F")
  
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text(COMPANY_CONFIG.name.toUpperCase(), 14, 15)
  
  doc.setFontSize(18)
  doc.text("FICHA DE ENTREGA DE EPI", pageWidth / 2, 22, { align: "center" })
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text("NR-06 | Certificado de Uso Individual", pageWidth / 2, 30, { align: "center" })
  
  doc.setFontSize(7)
  const today = data.deliveryDate ? format(new Date(data.deliveryDate), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })
  doc.text(today, pageWidth - 14, 15, { align: "right" })

  // 2. CARD: COLABORADOR (3 Columns)
  let currentY = 50
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(230, 230, 230)
  doc.roundedRect(14, currentY, pageWidth - 28, 35, 3, 3, "S")
  
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(r, g, b)
  doc.text(data.employeeName.toUpperCase(), 20, currentY + 10)
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  
  doc.text("CPF", 20, currentY + 18)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(data.employeeCpf, 20, currentY + 23)
  
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text("CARGO / FUNÇÃO", pageWidth / 2, currentY + 18)
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(data.employeeRole || "Não Informado", pageWidth / 2, currentY + 23)
  
  doc.setTextColor(100, 116, 139)
  doc.setFont("helvetica", "normal")
  doc.text("UNIDADE / CANTEIRO", pageWidth - 20, currentY + 18, { align: "right" })
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.text(data.workplaceName || "Sede", pageWidth - 20, currentY + 23, { align: "right" })

  // 3. CARD: DADOS DO EPI (Table — supports multiple items)
  currentY += 45
  autoTable(doc, {
    startY: currentY,
    head: [["Equipamento (EPI)", "Nº CA", "Venc. CA", "Qtd", "Motivo", "Data Entrega"]],
    body: pdfItems.map(item => [
      item.ppeName,
      item.ppeCaNumber,
      item.caExpiry ? format(new Date(item.caExpiry), "dd/MM/yyyy") : "—",
      String(item.quantity),
      item.reason,
      data.deliveryDate ? format(new Date(data.deliveryDate), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")
    ]),
    styles: { fontSize: 8.5, cellPadding: 4, font: "helvetica" },
    headStyles: { fillColor: [245, 245, 245], textColor: [71, 85, 105], fontStyle: "bold" },
    margin: { left: 14, right: 14 },
    theme: 'grid'
  })

  // 4. CARD: TERMO DE RESPONSABILIDADE
  // @ts-expect-error - jsPDF-autotable adds lastAutoTable to doc
  currentY = doc.lastAutoTable.finalY + 15
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(14, currentY, pageWidth - 28, 25, 2, 2, "S")
  
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(r, g, b)
  doc.text("TERMO DE RESPONSABILIDADE", 20, currentY + 7)
  
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  const termText = "Declaro ter recebido o(s) EPI(s) listado(s) acima em perfeito estado, comprometendo-me a utilizá-lo(s) para a finalidade a que se destina(m), responsabilizando-me pela sua guarda e conservação conforme NR-06 do MTE."
  const splitTerm = doc.splitTextToSize(termText, pageWidth - 36)
  doc.text(splitTerm, 18, currentY + 13, { align: "left" })

  // 5. CARD: BIOMETRIA / ASSINATURA
  // Smart detection: use actual image dimensions to decide rendering mode
  // Photos are portrait/square, signatures are wide landscape drawings
  currentY += 35
  
  let isPhoto = data.authMethod === 'facial' // Start with declared method
  let imgRatio = 1
  
  if (data.signatureBase64) {
    try {
      const imgProps = doc.getImageProperties(data.signatureBase64)
      imgRatio = imgProps.width / imgProps.height
      // If image is roughly square or portrait (ratio <= 1.5), it's likely a photo
      // Signature drawings are always very wide (ratio > 2)
      if (imgRatio <= 1.5) isPhoto = true
      if (imgRatio > 2.5) isPhoto = false
    } catch { /* keep declared method */ }
  }

  if (isPhoto && data.signatureBase64) {
    // ── BIOMETRIC PHOTO (proportional, centered) ──
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text("AUTENTICAÇÃO BIOMÉTRICA", pageWidth / 2, currentY, { align: "center" })
    
    const containerSize = 50
    const containerX = pageWidth / 2 - containerSize / 2
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(containerX - 2, currentY + 5, containerSize + 4, containerSize + 4, 3, 3, "FD")
    
    try {
      // Calculate proportional dimensions to fit inside container WITHOUT stretching
      let drawW: number, drawH: number
      
      if (imgRatio >= 1) {
        // Landscape or square: fit to width, calculate height
        drawW = containerSize
        drawH = containerSize / imgRatio
      } else {
        // Portrait: fit to height, calculate width
        drawH = containerSize
        drawW = containerSize * imgRatio
      }
      
      const drawX = containerX + (containerSize - drawW) / 2
      const drawY = currentY + 7 + (containerSize - drawH) / 2
      
      doc.addImage(data.signatureBase64, 'JPEG', drawX, drawY, drawW, drawH)
    } catch (e) {
      console.error("Error adding photo to PDF", e)
    }
    
    // Employee name below photo
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(data.employeeName.toUpperCase(), pageWidth / 2, currentY + containerSize + 16, { align: "center" })
    
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(148, 163, 184)
    doc.text("Identidade Validada por IA (face-api.js / TensorFlow)", pageWidth / 2, currentY + containerSize + 21, { align: "center" })
    
    currentY += containerSize + 30
  } else {
    // ── MANUAL SIGNATURE (proportional) ──
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text("ASSINATURA DO COLABORADOR", pageWidth / 2, currentY, { align: "center" })
    
    // Signature container
    const sigBoxW = 100
    const sigBoxH = 30
    const sigBoxX = (pageWidth - sigBoxW) / 2
    
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(252, 252, 252)
    doc.roundedRect(sigBoxX, currentY + 4, sigBoxW, sigBoxH, 2, 2, "FD")
    
    try {
      // Fit signature proportionally inside the box
      const imgProps = doc.getImageProperties(data.signatureBase64)
      const sigRatio = imgProps.width / imgProps.height
      let drawW = sigBoxW - 8
      let drawH = drawW / sigRatio
      if (drawH > sigBoxH - 6) {
        drawH = sigBoxH - 6
        drawW = drawH * sigRatio
      }
      const drawX = sigBoxX + (sigBoxW - drawW) / 2
      const drawY = currentY + 4 + (sigBoxH - drawH) / 2
      doc.addImage(data.signatureBase64, 'PNG', drawX, drawY, drawW, drawH)
    } catch {}
    
    // Signature line
    doc.setDrawColor(200, 200, 200)
    doc.line(sigBoxX + 10, currentY + sigBoxH + 6, sigBoxX + sigBoxW - 10, currentY + sigBoxH + 6)
    
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 41, 59)
    doc.text(data.employeeName.toUpperCase(), pageWidth / 2, currentY + sigBoxH + 12, { align: "center" })
    
    currentY += sigBoxH + 22
  }

  // 6. CARD: AUTENTICAÇÃO (2 Columns)
  doc.setFillColor(252, 252, 252)
  doc.setDrawColor(240, 240, 240)
  doc.roundedRect(14, currentY, pageWidth - 28, 35, 3, 3, "FD")
  
  // Left: Metadata
  const metaX = 20
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)
  doc.text("HASH DE VALIDAÇÃO", metaX, currentY + 10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text(hash, metaX, currentY + 14)
  
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)
  doc.text("IP DO TERMINAL", metaX, currentY + 21)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text(data.ipAddress || "Remoto", metaX, currentY + 25)
  
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)
  doc.text("GEOLOCALIZAÇÃO", metaX, currentY + 31)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(71, 85, 105)
  doc.text(data.location || "Coordenadas não capturadas", metaX, currentY + 35)

  // Right: QR Code
  try {
    const qrText = `${COMPANY_CONFIG.systemName} | Valid: ${hash} | Date: ${today}`
    const qrDataUrl = await QRCode.toDataURL(qrText, { width: 200, margin: 1 })
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 45, currentY + 5, 25, 25)
    doc.setFontSize(6)
    doc.setTextColor(200, 200, 200)
    doc.text("Scan to Verify", pageWidth - 32, currentY + 33, { align: "center" })
  } catch {}

  // 7. FOOTER (dynamic position — after auth card, not fixed to page bottom)
  currentY += 45
  doc.setDrawColor(230, 230, 230)
  doc.setLineWidth(0.3)
  doc.line(14, currentY, pageWidth - 14, currentY)
  doc.setFontSize(6.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(148, 163, 184)
  const footerText = `${COMPANY_CONFIG.systemName} Digital • NR-06 Compliance • Documento gerado automaticamente para fins de auditoria.`
  doc.text(footerText, pageWidth / 2, currentY + 6, { align: "center" })

  return doc.output("blob")
}


// ─────────────────────────────────────────────
// 2. RECIBO DE BAIXA / SUBSTITUIÇÃO
// ─────────────────────────────────────────────

export interface ReturnPDFData {
  employeeName: string
  employeeCpf: string
  workplaceName: string
  returnedItemName: string
  returnMotive: string
  newItemName?: string
  newItemCa?: string
  authMethod: 'manual' | 'facial'
  signatureBase64: string
}

export async function generateReturnPDF(data: ReturnPDFData): Promise<Blob> {
  const doc = new jsPDF({ format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const hash = Math.random().toString(36).substring(2, 12).toUpperCase()

  addPageHeader(doc, "RECIBO DE BAIXA / SUBSTITUIÇÃO E.P.I.", "Registro de Devolução e Troca — NR-06")

  const boxY = 46
  infoRow(doc, "Colaborador", data.employeeName, 14, boxY)
  infoRow(doc, "CPF", data.employeeCpf, 14, boxY + 12)
  infoRow(doc, "Unidade / Sede", data.workplaceName, pageWidth / 2, boxY + 12)

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, boxY + 20, pageWidth - 14, boxY + 20)

  const retY = boxY + 28
  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(252, 165, 165)
  doc.roundedRect(14, retY, (pageWidth - 28) / 2 - 4, 26, 3, 3, "FD")
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(r, g, b)
  doc.text("ITEM DEVOLVIDO / BAIXADO", 18, retY + 8)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text(data.returnedItemName, 18, retY + 16)
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Motivo: ${data.returnMotive}`, 18, retY + 23)

  if (data.newItemName) {
    doc.setFillColor(240, 253, 244)
    doc.setDrawColor(134, 239, 172)
    const halfW = (pageWidth - 28) / 2
    doc.roundedRect(14 + halfW + 4, retY, halfW - 4, 26, 3, 3, "FD")
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(21, 128, 61)
    doc.text("NOVO EPI ENTREGUE", 18 + halfW + 4, retY + 8)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)
    doc.text(data.newItemName, 18 + halfW + 4, retY + 16)
    if (data.newItemCa) {
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text(`CA: ${data.newItemCa}`, 18 + halfW + 4, retY + 23)
    }
  }

  const termY = retY + 34
  const term = data.newItemName
    ? "Confirmo a devolução do item antigo e o recebimento do novo equipamento listado acima em perfeitas condições de uso."
    : "Confirmo a devolução do item acima, encerrando minha responsabilidade sobre o mesmo. Estou ciente das implicações legais conforme NR-06."
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, termY, pageWidth - 28, 16, 3, 3, "FD")
  doc.setFont("helvetica", "italic")
  doc.setFontSize(7.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`"${term}"`, pageWidth / 2, termY + 10, { align: "center" })

  const sigY = termY + 24
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(14, sigY, pageWidth - 28, 50, 3, 3, "FD")
  try {
    if (data.authMethod === 'facial') {
      // Square photo, proportional
      doc.addImage(data.signatureBase64, 'JPEG', (pageWidth - 40) / 2, sigY + 3, 40, 40)
    } else {
      doc.addImage(data.signatureBase64, 'PNG', (pageWidth - 80) / 2, sigY + 5, 80, 30)
    }
  } catch { /* */ }
  doc.setLineWidth(0.5)
  doc.line(40, sigY + 42, pageWidth - 40, sigY + 42)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text(data.employeeName.toUpperCase(), pageWidth / 2, sigY + 47, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.text(`${data.authMethod === 'facial' ? 'Biometria Facial' : 'Assinatura Manual'} — ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, sigY + 52, { align: "center" })

  addPageFooter(doc, hash)
  return doc.output("blob")
}

// ─────────────────────────────────────────────
// 3. FICHA NR-06 (Prontuário do Colaborador)
// ─────────────────────────────────────────────

export interface NR06PDFData {
  employeeName: string
  employeeCpf: string
  employeeRole: string
  employeeDepartment: string
  workplaceName: string
  admissionDate: string
  items: {
    deliveryDate: string
    ppeName: string
    caNr: string
    quantity: number
    reason: string
    returnedAt?: string | null
    isExpired: boolean
    signatureUrl?: string | null   // URL da assinatura/foto da entrega
    signatureBase64?: string        // Base64 para embed direto no PDF
  }[]
  tstSigner?: {
    name: string
    role: string
    signatureBase64: string
    authMethod: 'manual' | 'facial'
  }
}

export async function generateNR06PDF(data: NR06PDFData): Promise<Blob> {
  const doc = new jsPDF({ format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  addPageHeader(doc, "FICHA DE CONTROLE DE EPI — NR-06", "Documento de Prontuário Individual do Colaborador")

  const boxY = 46
  const col = (pageWidth - 28) / 3

  const fields = [
    { label: "Colaborador", value: data.employeeName },
    { label: "CPF", value: data.employeeCpf },
    { label: "Cargo / Função", value: data.employeeRole },
    { label: "Setor / Depto.", value: data.employeeDepartment },
    { label: "Canteiro / Unidade", value: data.workplaceName },
    { label: "Data de Admissão", value: data.admissionDate },
  ]

  fields.forEach((f, i) => {
    const x = 14 + (i % 3) * col
    const y = boxY + Math.floor(i / 3) * 17
    infoRow(doc, f.label, f.value, x, y)
  })

  // ── Resolve all signatures to base64 before drawing ──
  const itemsWithSigs = await Promise.all(
    data.items.map(async (item) => {
      if (item.signatureBase64) return item
      if (item.signatureUrl) {
        try {
          const res = await fetch(item.signatureUrl)
          const blob = await res.blob()
          const b64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          return { ...item, signatureBase64: b64 }
        } catch { /* fallback: no sig */ }
      }
      return item
    })
  )

  const tableY = boxY + 38
  autoTable(doc, {
    startY: tableY,
    head: [["Data", "EPI", "Nº C.A.", "Qtd", "Motivo", "Status", "Devolução", "Assinatura"]],
    body: itemsWithSigs.map(item => [
      item.deliveryDate,
      item.ppeName,
      item.caNr,
      item.quantity,
      item.reason,
      item.returnedAt ? "Devolvido" : item.isExpired ? "⚠ Troca Pendente" : "Em uso",
      item.returnedAt ? format(new Date(item.returnedAt), "dd/MM/yyyy") : "—",
      "", // placeholder for signature image — drawn in didDrawCell
    ]),
    styles: {
      fontSize: 7,
      cellPadding: { top: 6, right: 3, bottom: 6, left: 3 },
      font: "helvetica",
      textColor: [30, 41, 59],
      minCellHeight: 12,
    },
    headStyles: {
      fillColor: [r, g, b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      2: { halign: "center", cellWidth: 14 },
      3: { halign: "center", cellWidth: 12 },
      5: { halign: "center" },
      6: { halign: "center", cellWidth: 18 },
      7: { cellWidth: 32, halign: "center" },
    },
    willDrawCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const val = String(hookData.cell.raw)
        if (val.includes("Troca")) hookData.cell.styles.textColor = [r, g, b]
        if (val === "Devolvido") hookData.cell.styles.textColor = [21, 128, 61]
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 7) {
        const rowIndex = hookData.row.index
        const item = itemsWithSigs[rowIndex]
        if (!item?.signatureBase64) return

        const cell = hookData.cell
        const maxW = cell.width - 4
        const maxH = cell.height - 4
        const x = cell.x + 2
        const y = cell.y + 2

        try {
          const imgProps = doc.getImageProperties(item.signatureBase64)
          const ratio = imgProps.width / imgProps.height
          let drawW = maxW, drawH = maxW / ratio
          if (drawH > maxH) { drawH = maxH; drawW = maxH * ratio }
          const dx = x + (maxW - drawW) / 2
          const dy = y + (maxH - drawH) / 2
          const fmt = item.signatureBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(item.signatureBase64, fmt, dx, dy, drawW, drawH)
        } catch { /* skip if image fails */ }
      }
    },
    margin: { left: 14, right: 14 },
  })

  // @ts-expect-error - jsPDF-autotable adds lastAutoTable to doc
  let finalY = doc.lastAutoTable?.finalY || 200
  finalY += 12

  // TST signer block
  if (data.tstSigner) {
    const tst = data.tstSigner
    const blockWidth = 88
    const blockX = (pageWidth - blockWidth) / 2
    const blockY = finalY
    const contentX = blockX + 16
    const contentWidth = blockWidth - 32
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.8)
    doc.roundedRect(blockX, blockY, blockWidth, 50, 4, 4)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(71, 85, 105)
    doc.text("ASSINATURA DO RESPONS\u00c1VEL T\u00c9CNICO", pageWidth / 2, blockY + 7, { align: "center" })

    try {
      const imgProps = doc.getImageProperties(tst.signatureBase64)
      const ratio = imgProps.width / imgProps.height
      const isPhoto = ratio <= 1.5
      const drawH = isPhoto ? 20 : 12
      let drawW = drawH * ratio
      if (drawW > contentWidth) {
        drawW = contentWidth
      }
      const sigX = contentX
      const sigY = blockY + 12
      const fmt = tst.signatureBase64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(tst.signatureBase64, fmt, sigX, sigY, drawW, drawH)
    } catch { /* skip */ }

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.line(contentX, blockY + 34, contentX + contentWidth, blockY + 34)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(30, 41, 59)
    doc.text(tst.name.toUpperCase(), contentX, blockY + 40)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(102, 102, 102)
    doc.text(tst.role, contentX, blockY + 45)

    finalY += 56
  }

  const emitDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const footerY = pageHeight - 24
  doc.setFillColor(248, 250, 252)
  doc.rect(0, footerY - 8, pageWidth, 20, "F")
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4)

  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(100, 116, 139)
  doc.text(`Documento emitido em ${emitDate} pelo ${COMPANY_CONFIG.systemName}.`, 14, footerY + 2)
  doc.text(`${COMPANY_CONFIG.systemName} • NR-06 Compliance • Identidade Digital Verificada`, 14, footerY + 6)

  return doc.output("blob")
}

// ─────────────────────────────────────────────
// 3. RELATÓRIO GERAL (ANALYTICS)
// ─────────────────────────────────────────────

export interface ReportPDFData {
  stats: { label: string; value: string; change: string }[]
  deliveries: DeliveryWithRelations[] // Array of deliveries to list
  periodTitle?: string
}

export function generateGeneralReportPDF(data: ReportPDFData): Blob {
  const doc = new jsPDF({ format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()

  const subtitle = data.periodTitle ? `Métricas Globais e Rastreabilidade • ${data.periodTitle}` : "Métricas Globais e Rastreabilidade (NR-06)"
  addPageHeader(doc, "RELATÓRIO DE CONFORMIDADE E CUSTOS", subtitle)

  // Metrics Dashboard
  let currentY = 50
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(r, g, b)
  doc.text("MÉTRICAS GLOBAIS", 14, currentY)
  currentY += 8

  // Draw 4 cards for metrics
  const cardWidth = (pageWidth - 28 - (3 * 5)) / 4
  
  data.stats.forEach((stat, i) => {
    const x = 14 + (i * (cardWidth + 5))
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(x, currentY, cardWidth, 22, 2, 2, "FD")
    
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(stat.label.substring(0, 20), x + 3, currentY + 7)
    
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    doc.text(stat.value, x + 3, currentY + 14)
    
    doc.setFontSize(6)
    doc.setTextColor(r, g, b)
    doc.text(stat.change, x + 3, currentY + 19)
  })

  currentY += 35

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(r, g, b)
  doc.text("HISTÓRICO RECENTE DE TRANSAÇÕES", 14, currentY)
  currentY += 5

  const recentDeliveries = data.deliveries.slice(0, 50) // Limit to 50 for the PDF

  autoTable(doc, {
    startY: currentY,
    head: [["Data", "Colaborador", "EPI (C.A.)", "Qtd", "Local"]],
    body: recentDeliveries.map(d => [
      format(new Date(d.delivery_date), "dd/MM/yyyy HH:mm"),
      d.employee?.full_name || 'N/A',
      `${d.ppe?.name || 'N/A'} (${d.ppe?.ca_number || 'N/A'})`,
      String(d.quantity),
      d.workplace?.name || 'Sede'
    ]),
    styles: { fontSize: 7, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: [r, g, b], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    theme: 'grid'
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || 200
  const emitDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(100, 116, 139)
  doc.text(`Relatório gerado em ${emitDate} pelo sistema.`, 14, finalY + 10)

  addPageFooter(doc)
  return doc.output("blob")
}

export interface TrainingCertificateData {
  employeeName: string
  employeeCpf: string
  trainingName: string
  completionDate: string
  expiryDate: string
  instructorName?: string
  instructorRole?: string
  signatureBase64?: string
}

export function generateTrainingCertificate(data: TrainingCertificateData): Blob {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const centerX = pageWidth / 2

  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageWidth, pageHeight, "F")

  doc.setDrawColor(r, g, b)
  doc.setLineWidth(2)
  doc.rect(16, 16, pageWidth - 32, pageHeight - 32)

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.rect(20, 20, pageWidth - 40, pageHeight - 40)

  if (COMPANY_CONFIG.logoUrl) {
    try {
      const imgWidth = 40
      const imgHeight = 15
      doc.addImage(COMPANY_CONFIG.logoUrl, "PNG", centerX - imgWidth / 2, 26, imgWidth, imgHeight)
    } catch {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(24)
      doc.setTextColor(r, g, b)
      doc.text(COMPANY_CONFIG.name, centerX, 38, { align: "center" })
    }
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(24)
    doc.setTextColor(r, g, b)
    doc.text(COMPANY_CONFIG.name, centerX, 38, { align: "center" })
  }

  doc.setFont("times", "bold")
  doc.setFontSize(36)
  doc.setTextColor(30, 41, 59)
  doc.text("CERTIFICADO DE CONCLUS\u00c3O", centerX, 62, { align: "center" })

  doc.setFont("helvetica", "italic")
  doc.setFontSize(10)
  doc.setTextColor(102, 102, 102)
  doc.text("Certificamos para os devidos fins que", centerX, 76, { align: "center" })

  doc.setFont("times", "bolditalic")
  doc.setFontSize(28)
  doc.setTextColor(r, g, b)
  doc.text(data.employeeName.toUpperCase(), centerX, 96, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.text(`Portador(a) do CPF: ${data.employeeCpf}`, centerX, 108, { align: "center" })

  doc.setFont("helvetica", "italic")
  doc.setFontSize(10)
  doc.setTextColor(102, 102, 102)
  doc.text("concluiu com \u00eaxito o treinamento de", centerX, 126, { align: "center" })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(30, 41, 59)
  doc.text(data.trainingName.toUpperCase(), centerX, 138, { align: "center" })

  const completionText = format(new Date(data.completionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  const validUntilText = format(new Date(data.expiryDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  doc.setTextColor(71, 85, 105)
  doc.text(`Realizado em: ${completionText}  |  V\u00e1lido at\u00e9: ${validUntilText}`, centerX, 150, { align: "center" })

  const signerBlockX = centerX - 40
  const signerBlockWidth = 80
  const imageTopY = 162
  const separatorY = 186
  const signerNameY = 193
  const signerRoleY = 198

  if (data.instructorName) {
    if (data.signatureBase64) {
      try {
        const imgProps = doc.getImageProperties(data.signatureBase64)
        const ratio = imgProps.width / imgProps.height
        const isPhoto = ratio <= 1.5
        const maxW = isPhoto ? 18 : 34
        const maxH = isPhoto ? 18 : 10
        let drawW = maxW
        let drawH = drawW / ratio

        if (drawH > maxH) {
          drawH = maxH
          drawW = drawH * ratio
        }

        const sigX = centerX - drawW / 2
        const sigY = imageTopY
        const fmt = data.signatureBase64.startsWith("data:image/png") ? "PNG" : "JPEG"

        if (isPhoto) {
          doc.setDrawColor(203, 213, 225)
          doc.setFillColor(255, 255, 255)
          doc.roundedRect(sigX - 2, sigY - 2, drawW + 4, drawH + 4, 2, 2, "FD")
        }

        doc.addImage(data.signatureBase64, fmt, sigX, sigY, drawW, drawH)
      } catch {
        // ignore invalid signature image
      }
    }

    doc.setDrawColor(148, 163, 184)
    doc.setLineWidth(0.5)
    doc.line(signerBlockX, separatorY, signerBlockX + signerBlockWidth, separatorY)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    doc.text(data.instructorName.toUpperCase(), centerX, signerNameY, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(102, 102, 102)
    doc.text(data.instructorRole || "Instrutor / Respons\u00e1vel T\u00e9cnico", centerX, signerRoleY, { align: "center" })
  }

  doc.setFontSize(8)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(148, 163, 184)
  const issuedAt = format(new Date(), "dd/MM/yyyy '\u00e0s' HH:mm")
  doc.text(`Documento emitido digitalmente em ${issuedAt} via ${COMPANY_CONFIG.systemName}`, 20, pageHeight - 12)

  return doc.output("blob")
}

// ─────────────────────────────────────────────
// MOVEMENTS REPORT — SIMPLE & PRESENTATION PDF
// ─────────────────────────────────────────────

export interface MovementsStats {
  deliveries: number
  returns: number
  totalItems: number
  uniqueEmployees: number
}

export interface MovementsReportData {
  movements: DeliveryWithRelations[]
  stats: MovementsStats
  period: string
}

// ── Simple / Operational PDF ──
export function generateMovementsSimplePDF(data: MovementsReportData): void {
  const doc = new jsPDF({ orientation: "portrait", format: "a4" })
  const pw = doc.internal.pageSize.getWidth()

  // Header bar
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, pw, 36, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(255, 255, 255)
  doc.text("RELATÓRIO DE MOVIMENTAÇÕES", 14, 15)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`Período: ${data.period}`, 14, 26)
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pw - 14, 26, { align: "right" })

  // Stats bar
  const statLabels = ["Entregas", "Devoluções", "Itens", "Pessoas"]
  const statValues = [data.stats.deliveries, data.stats.returns, data.stats.totalItems, data.stats.uniqueEmployees]
  const colW = pw / 4
  statLabels.forEach((label, i) => {
    const x = i * colW
    doc.setFillColor(i % 2 === 0 ? 248 : 241, i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 252 : 248)
    doc.rect(x, 36, colW, 22, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(r, g, b)
    doc.text(String(statValues[i]), x + colW / 2, 50, { align: "center" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), x + colW / 2, 56, { align: "center" })
  })

  // Table
  autoTable(doc, {
    startY: 62,
    head: [["Data", "Colaborador", "EPI", "Qtd", "Tipo", "Unidade"]],
    body: data.movements.map(m => [
      format(new Date(m.delivery_date), "dd/MM/yy"),
      m.employee?.full_name || "-",
      m.ppe?.name || "-",
      String(m.quantity),
      m.returned_at ? "Devolução" : "Entrega",
      m.workplace?.name || "Geral"
    ]),
    headStyles: { fillColor: [r, g, b], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
    },
    margin: { left: 10, right: 10 },
    theme: "grid",
  })

  // Footer
  const ph = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.setTextColor(148, 163, 184)
  doc.text(`${COMPANY_CONFIG.name} — ${COMPANY_CONFIG.systemName}`, 10, ph - 8)
  doc.text(`Total: ${data.movements.length} registros`, pw - 10, ph - 8, { align: "right" })

  doc.save(`Movimentacoes_Simples_${format(new Date(), "yyyyMMdd")}.pdf`)
}

// ── Presentation PDF (Landscape, rich visual) ──
export function generateMovementsPresentationPDF(data: MovementsReportData): void {
  const doc = new jsPDF({ orientation: "landscape", format: "a4" })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()

  // ── PAGE 1: Executive Summary ──

  // Dark sidebar accent
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, 8, ph, "F")

  // Top gradient background area
  doc.setFillColor(15, 23, 42)
  doc.rect(8, 0, pw - 8, 55, "F")

  // Company name
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(r, g, b)
  doc.text(COMPANY_CONFIG.name.toUpperCase(), 18, 14)

  // Report title
  doc.setFont("times", "bolditalic")
  doc.setFontSize(28)
  doc.setTextColor(255, 255, 255)
  doc.text("Relatório de Movimentações", 18, 32)

  // Subtitle/period
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184)
  doc.text(`Período: ${data.period}`, 18, 42)
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | ${COMPANY_CONFIG.systemName}`, 18, 50)

  // ── KPI Cards ──
  const kpis = [
    { label: "TOTAL ENTREGAS", value: data.stats.deliveries, color: [37, 99, 235] as [number,number,number] },
    { label: "DEVOLUÇÕES", value: data.stats.returns, color: [217, 119, 6] as [number,number,number] },
    { label: "ITENS MOVIM.", value: data.stats.totalItems, color: [r, g, b] as [number,number,number] },
    { label: "COLABORAD.", value: data.stats.uniqueEmployees, color: [5, 150, 105] as [number,number,number] },
  ]

  const cardW = 55
  const cardH = 34
  const cardY = 62
  const cardGap = 8
  const totalCardsW = kpis.length * cardW + (kpis.length - 1) * cardGap
  const cardStartX = (pw - totalCardsW) / 2

  kpis.forEach((kpi, i) => {
    const cx = cardStartX + i * (cardW + cardGap)
    // Card shadow effect
    doc.setFillColor(226, 232, 240)
    doc.roundedRect(cx + 1, cardY + 1, cardW, cardH, 4, 4, "F")
    // Card background
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(cx, cardY, cardW, cardH, 4, 4, "F")
    // Left accent bar
    doc.setFillColor(...kpi.color)
    doc.roundedRect(cx, cardY, 4, cardH, 2, 2, "F")
    // Value
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.setTextColor(...kpi.color)
    doc.text(String(kpi.value), cx + cardW / 2 + 2, cardY + 20, { align: "center" })
    // Label
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label, cx + cardW / 2 + 2, cardY + 29, { align: "center" })
  })

  // ── Bar Chart: Top EPIs ──
  const epiCount: Record<string, number> = {}
  data.movements.forEach(m => {
    const name = m.ppe?.name || "Outro"
    epiCount[name] = (epiCount[name] || 0) + m.quantity
  })
  const topEpis = Object.entries(epiCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const chartX = 18
  const chartY = 108
  const chartW = 120
  const chartH = 70
  const barMaxVal = topEpis[0]?.[1] || 1

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text("TOP EPIS MAIS ENTREGUES", chartX, chartY - 3)

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)

  const barH = (chartH - 10) / Math.max(topEpis.length, 1)
  topEpis.forEach(([name, count], i) => {
    const y = chartY + i * barH + 4
    const barWidth = (count / barMaxVal) * chartW
    // Background track
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(chartX + 40, y, chartW, barH - 4, 2, 2, "F")
    // Filled bar
    doc.setFillColor(r, g, b)
    if (barWidth > 0) doc.roundedRect(chartX + 40, y, barWidth, barH - 4, 2, 2, "F")
    // Label
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(30, 41, 59)
    const truncated = name.length > 18 ? name.slice(0, 18) + "…" : name
    doc.text(truncated, chartX + 38, y + barH / 2 - 0.5, { align: "right" })
    // Count
    doc.setFont("helvetica", "bold")
    doc.setTextColor(r, g, b)
    doc.text(String(count), chartX + 44 + barWidth, y + barH / 2 - 0.5)
  })

  // ── Donut-style Pie: Entrega vs Devolução ──
  const pieX = 220
  const pieY = 128
  const pieR = 28

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text("ENTREGAS vs DEVOLUÇÕES", pieX - 28, chartY - 3)

  const total = data.stats.deliveries + data.stats.returns
  if (total > 0) {
    const delivPct = data.stats.deliveries / total
    // Draw two rectangles as a simple horizontal stacked bar
    const barTotalW = 80
    const barY = pieY
    const barHeight = 20

    doc.setFillColor(37, 99, 235)
    doc.roundedRect(pieX - 28, barY, barTotalW * delivPct, barHeight, 3, 3, "F")
    doc.setFillColor(217, 119, 6)
    doc.roundedRect(pieX - 28 + barTotalW * delivPct, barY, barTotalW * (1 - delivPct), barHeight, 3, 3, "F")

    // Legend
    const legendY = barY + barHeight + 10
    doc.setFillColor(37, 99, 235)
    doc.rect(pieX - 28, legendY, 5, 5, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text(`Entregas: ${data.stats.deliveries} (${Math.round(delivPct * 100)}%)`, pieX - 20, legendY + 4.5)

    doc.setFillColor(217, 119, 6)
    doc.rect(pieX - 28, legendY + 10, 5, 5, "F")
    doc.text(`Devoluções: ${data.stats.returns} (${Math.round((1 - delivPct) * 100)}%)`, pieX - 20, legendY + 14.5)
  }

  // ── Per-Workplace breakdown ──
  const wpCount: Record<string, number> = {}
  data.movements.forEach(m => {
    const wp = m.workplace?.name || "Geral"
    wpCount[wp] = (wpCount[wp] || 0) + 1
  })
  const topWp = Object.entries(wpCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const wpX = pw - 100
  const wpY = chartY
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text("MOVIM. POR UNIDADE", wpX, wpY - 3)

  topWp.forEach(([wp, count], i) => {
    const y = wpY + i * 14
    const pct = count / data.movements.length
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(wpX, y, 80, 10, 2, 2, "F")
    doc.setFillColor(5, 150, 105)
    doc.roundedRect(wpX, y, 80 * pct, 10, 2, 2, "F")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255)
    const wpLabel = wp.length > 22 ? wp.slice(0, 22) + "…" : wp
    doc.text(`${wpLabel} (${count})`, wpX + 3, y + 7)
  })

  // ── Footer page 1 ──
  doc.setFillColor(15, 23, 42)
  doc.rect(8, ph - 12, pw - 8, 12, "F")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`${COMPANY_CONFIG.name} — Confidencial — ${COMPANY_CONFIG.systemName}`, pw / 2, ph - 5, { align: "center" })
  doc.text("1", pw - 12, ph - 5)

  // ── PAGE 2: Full Movement Table ──
  doc.addPage()

  doc.setFillColor(r, g, b)
  doc.rect(0, 0, 8, ph, "F")
  doc.setFillColor(15, 23, 42)
  doc.rect(8, 0, pw - 8, 22, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text("DETALHAMENTO DE MOVIMENTAÇÕES", 18, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`${data.period} — Total: ${data.movements.length} registros`, pw - 12, 14, { align: "right" })

  autoTable(doc, {
    startY: 26,
    head: [["Data", "Colaborador", "CPF", "EPI / CA", "Qtd", "Tipo", "Unidade"]],
    body: data.movements.map(m => [
      format(new Date(m.delivery_date), "dd/MM/yyyy"),
      m.employee?.full_name || "-",
      m.employee?.cpf || "-",
      `${m.ppe?.name || "-"} (CA ${m.ppe?.ca_number || "-"})`,
      String(m.quantity),
      m.returned_at ? "Devolução" : "Entrega",
      m.workplace?.name || "Geral"
    ]),
    headStyles: { fillColor: [r, g, b], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { cellWidth: 28 },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
    },
    margin: { left: 12, right: 12 },
    theme: "grid",
    didParseCell: (hookData) => {
      if (hookData.column.index === 5 && hookData.section === "body") {
        const val = hookData.cell.raw as string
        if (val === "Entrega") hookData.cell.styles.textColor = [5, 150, 105]
        if (val === "Devolução") hookData.cell.styles.textColor = [217, 119, 6]
      }
    }
  })

  // Footer page 2
  doc.setFillColor(15, 23, 42)
  doc.rect(8, ph - 12, pw - 8, 12, "F")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(`${COMPANY_CONFIG.name} — Confidencial — ${COMPANY_CONFIG.systemName}`, pw / 2, ph - 5, { align: "center" })
  doc.text("2", pw - 12, ph - 5)

  doc.save(`Movimentacoes_Apresentacao_${format(new Date(), "yyyyMMdd")}.pdf`)
}
