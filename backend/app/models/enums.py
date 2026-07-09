import enum


class OrderStatus(str, enum.Enum):
    pending = "pending"            # created, awaiting restaurant confirmation
    confirmed = "confirmed"        # restaurant accepted
    preparing = "preparing"        # being cooked
    ready = "ready"                # ready for pickup by courier
    accepted = "accepted"          # courier accepted / picked up the order
    delivering = "delivering"      # courier on the way
    delivered = "delivered"        # completed
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    cash = "cash"                  # cash on delivery
    payme = "payme"
    click = "click"
    uzum = "uzum"


class PaymentStatus(str, enum.Enum):
    unpaid = "unpaid"
    paid = "paid"
    refunded = "refunded"


class AdminRole(str, enum.Enum):
    superadmin = "superadmin"
    manager = "manager"
    courier = "courier"


class AnnouncementStatus(str, enum.Enum):
    pending = "pending"    # created, broadcast not started yet
    sending = "sending"    # broadcast in progress
    sent = "sent"          # broadcast finished
