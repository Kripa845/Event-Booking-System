from django.core.mail import EmailMessage


def send_ticket_email(ticket):
    """Email the ticket holder their ticket details with the QR code attached."""
    booking = ticket.booking
    user, event = booking.user, booking.event
    place = f"{event.venue}, {event.location}" if event.venue else event.location
    body = "\n".join([
        f"Hi {user.username},",
        "",
        f"Your ticket for {event.title} is confirmed! 🎟️",
        "",
        f"Date:   {event.date:%A, %d %B %Y}",
        f"Time:   {event.start_time:%H:%M} – {event.end_time:%H:%M}",
        f"Venue:  {place}",
        f"Ticket: {ticket.ticket_number}",
        "",
        "Show the attached QR code at the entrance. You can also open it any time in",
        "My Tickets, where you can save it as an image or PDF.",
        "",
        "— The EventHub team",
    ])
    message = EmailMessage(f"Your ticket: {event.title}", body, to=[user.email])
    if ticket.qr_code:
        with ticket.qr_code.open("rb") as qr:
            message.attach(f"{ticket.ticket_number}.png", qr.read(), "image/png")
    message.send(fail_silently=True)
