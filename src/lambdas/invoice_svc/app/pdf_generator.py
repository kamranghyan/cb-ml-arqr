import os
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def generate_invoice_pdf(invoice_id: str, order_id: str, amount: float, currency: str = "PKR") -> bytes:
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    # Header
    p.setFont("Helvetica-Bold", 20)
    p.drawString(200, 750, "INVOICE")
    
    # Details
    p.setFont("Helvetica", 12)
    p.drawString(50, 680, f"Invoice ID: {invoice_id}")
    p.drawString(50, 660, f"Order ID: {order_id}")
    p.drawString(50, 640, f"Amount Paid: {amount} {currency}")
    p.drawString(50, 620, f"Status: PAID")
    
    p.showPage()
    p.save()
    
    buffer.seek(0)
    return buffer.getvalue()