# Webkinz Trading Hub

A web application designed to allow Webkinz users to:
- Browse tradeable items
- Search tradeable items
- Track inventory and wishlist items
- Find reciprocal wishlist matches
- Send, receive, accept, decline, or withdraw trade offers
- Share contact details after an offer is accepted and confirm completion together

Accepting an offer reveals the sender's chosen contact method to the recipient. Traders arrange and complete the item exchange outside the hub; both parties can then confirm completion in the app. The hub does not automatically change either user's inventory.

Before deploying the offer workflow, apply `backend/migrations/002_trade_offers.sql` and `backend/migrations/003_offer_contact_completion.sql` to the database in order. Offers are stored separately from inventory and wishlist entries.