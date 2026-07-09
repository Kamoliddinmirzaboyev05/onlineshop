from datetime import date

from pydantic import BaseModel, Field


class StatBucket(BaseModel):
    delivered: int = 0
    earnings: int = 0          # sum of delivery_fee on delivered orders
    cancelled: int = 0


class DaySeries(BaseModel):
    date: date
    delivered: int = 0
    earnings: int = 0


class CourierStats(BaseModel):
    today: StatBucket
    week: StatBucket
    month: StatBucket
    active: int = 0            # orders currently ready/delivering
    series: list[DaySeries] = []   # last 7 days, oldest first


class EarningsDay(BaseModel):
    date: date
    delivered: int = 0
    earnings: int = 0


class EarningsOut(BaseModel):
    days: int
    total_delivered: int = 0
    total_earnings: int = 0
    series: list[EarningsDay] = []   # oldest first


class ChangePasswordIn(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=128)
