# Webkinz Trading Hub

A web application designed to allow Webkinz users to:
- Browse tradeable items
- Search tradeable items
- Track inventory and wishlist items
- Find reciprocal wishlist matches
- Send, receive, accept, decline, or withdraw trade offers

Accepting an offer records the agreement in the hub. The actual item exchange still happens in Webkinz, and the hub does not automatically change either user's inventory.

Before deploying the offer API, apply `backend/migrations/002_trade_offers.sql` to the database. Offers are stored separately from inventory and wishlist entries.