from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
p = Path(__file__).resolve().parents[1] / 'qa' / 'attachments' / 'termo-chaves-ficticio.pdf'
c = canvas.Canvas(str(p), pagesize=A4)
c.setTitle('Termo de entrega das chaves — fictício')
c.setFont('Helvetica', 10)
c.drawString(55, 780, 'ELOJUS / DOCUMENTO FICTÍCIO PARA DEMONSTRAÇÃO')
c.setLineWidth(.6); c.line(55, 763, 540, 763)
c.setFont('Times-Roman', 24); c.drawString(55, 720, 'Termo de entrega das chaves')
c.setFont('Helvetica', 11)
lines = ['Caso ilustrativo: Bruno Exemplo e Locadora Exemplo.', 'Data ilustrativa: 10 de outubro de 2026.', '', 'Para demonstrar o fluxo de vinculação de documentos, este termo', 'registra a entrega das chaves do imóvel fictício à locadora.', '', 'O documento não atesta o estado do imóvel nem a quitação', 'de obrigações. Esses pontos dependem de outros elementos.', '', 'Material fictício. Não é um comprovante ou instrumento real.']
t = c.beginText(55, 675); t.setLeading(22)
for line in lines: t.textLine(line)
c.drawText(t); c.setFont('Helvetica', 9); c.drawString(55, 55, 'Demonstração local · Sem assinatura · Página 1'); c.save()
print(p)
