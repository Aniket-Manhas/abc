import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading
import config
from datetime import datetime

# Risk level to color mapping
RISK_COLORS = {
    "DANGER":    "#c0392b",      # Red
    "HIGH RISK": "#e67e22",      # Orange
    "WARNING":   "#f39c12",      # Yellow
    "SAFE":      "#27ae60",      # Green
}

RISK_BG_COLORS = {
    "DANGER":    "#ffebee",      # Light red
    "HIGH RISK": "#fff3e0",      # Light orange
    "WARNING":   "#fffde7",      # Light yellow
    "SAFE":      "#e8f5e9",      # Light green
}

def _get_risk_level(subject):
    """Extract risk level from email subject."""
    subject_upper = subject.upper()
    for risk_level in ["DANGER", "HIGH RISK", "WARNING", "SAFE"]:
        if risk_level in subject_upper:
            return risk_level
    return "SAFE"

def _send_email_async(subject, body, risk_level=None):
    if not config.ENABLE_EMAIL_ALERTS:
        return

    sender_email = config.MAIL_USERNAME
    receiver_email = config.ADMIN_ALERT_EMAIL
    password = config.MAIL_PASSWORD
    smtp_server = config.MAIL_SERVER
    port = config.MAIL_PORT

    if not all([sender_email, receiver_email, password, smtp_server]):
        print("[Mailer] Error: Missing email configuration in .env")
        return

    # Auto-detect risk level if not provided
    if not risk_level:
        risk_level = _get_risk_level(subject)

    # Select colors based on risk level
    bg_color = RISK_BG_COLORS.get(risk_level, RISK_BG_COLORS["SAFE"])
    text_color = RISK_COLORS.get(risk_level, RISK_COLORS["SAFE"])
    border_color = RISK_COLORS.get(risk_level, RISK_COLORS["SAFE"])

    # Create HTML email with colored background
    html_body = f"""
    <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; }}
                .container {{ 
                    max-width: 600px; 
                    margin: 0 auto; 
                    padding: 20px;
                    background-color: {bg_color};
                    border-left: 5px solid {border_color};
                }}
                .header {{ 
                    color: {text_color};
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    padding: 10px;
                    background-color: rgba(255, 255, 255, 0.7);
                    border-radius: 5px;
                }}
                .content {{ 
                    color: #333;
                    font-size: 16px;
                    line-height: 1.6;
                    padding: 15px;
                    background-color: rgba(255, 255, 255, 0.9);
                    border-radius: 5px;
                    margin-bottom: 15px;
                }}
                .footer {{ 
                    color: #666;
                    font-size: 12px;
                    text-align: center;
                    padding: 10px;
                    margin-top: 10px;
                }}
                .risk-badge {{
                    display: inline-block;
                    padding: 8px 12px;
                    background-color: {text_color};
                    color: white;
                    border-radius: 3px;
                    font-weight: bold;
                    margin-right: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <span class="risk-badge">{risk_level}</span>
                    {subject}
                </div>
                <div class="content">
                    {body.replace(chr(10), '<br>')}
                </div>
                <div class="footer">
                    <p>Sahyatri Crowd Monitoring System</p>
                    <p>Alert generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                </div>
            </div>
        </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender_email
    message["To"] = receiver_email

    # Attach both plain text and HTML versions
    part1 = MIMEText(body, "plain")
    part2 = MIMEText(html_body, "html")
    message.attach(part1)
    message.attach(part2)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
            print(f"[Mailer] Alert email sent successfully to {receiver_email} (Risk: {risk_level})")
    except Exception as e:
        print(f"[Mailer] Failed to send email: {e}")

def send_alert(subject, body, risk_level=None):
    """Sends an email asynchronously to avoid blocking the video stream.
    
    Args:
        subject: Email subject line
        body: Email body (plain text)
        risk_level: Risk level (SAFE, WARNING, HIGH RISK, DANGER). Auto-detected if None.
    """
    thread = threading.Thread(target=_send_email_async, args=(subject, body, risk_level))
    thread.daemon = True
    thread.start()
