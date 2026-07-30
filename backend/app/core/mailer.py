"""
Sends the email-verification code.

Configure via env vars (backend/.env):
    SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME

Works with Gmail (smtp.gmail.com, port 587, an *App Password* — not your normal
password, Google requires 2FA + an app password for SMTP), Outlook, or any
transactional provider's SMTP relay (SendGrid, Mailgun, Resend, etc.).

If SMTP_HOST isn't set, the code is printed to the backend console instead of
emailed — handy for developing the verification flow before wiring up real
email.
"""
import os
import smtplib
import ssl
from email.message import EmailMessage

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", SMTP_USERNAME)
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "Fine Arc")


def send_verification_email(to_email: str, code: str) -> None:
    if not SMTP_HOST:
        print(f"[finearc] DEV MODE (no SMTP configured): verification code for {to_email} is {code}")
        return

    message = EmailMessage()
    message["Subject"] = "Your Fine Arc verification code"
    message["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message.set_content(
        f"Your Fine Arc verification code is: {code}\n\n"
        f"This code expires in 15 minutes. If you didn't request this, you can ignore this email."
    )
    message.add_alternative(
        f"""\
<div style="font-family: sans-serif; max-width: 480px; margin: auto;">
  <h2 style="margin-bottom: 4px;">Verify your email</h2>
  <p style="color: #555;">Enter this code to finish creating your Fine Arc account:</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 24px 0;">{code}</p>
  <p style="color: #888; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
</div>
""",
        subtype="html",
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)