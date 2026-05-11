import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import threading
import config

def _send_email_async(subject, body):
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

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender_email
    message["To"] = receiver_email

    text = body
    part1 = MIMEText(text, "plain")
    message.attach(part1)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
            print(f"[Mailer] Alert email sent successfully to {receiver_email}")
    except Exception as e:
        print(f"[Mailer] Failed to send email: {e}")

def send_alert(subject, body):
    """Sends an email asynchronously to avoid blocking the video stream."""
    thread = threading.Thread(target=_send_email_async, args=(subject, body))
    thread.daemon = True
    thread.start()
