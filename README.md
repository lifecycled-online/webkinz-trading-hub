# Webkinz Trading Hub

A web application designed to allow Webkinz users to:
- Browse tradeable items
- Search tradeable items
- Track inventory and wishlist items
- Find reciprocal wishlist matches
- Send, receive, accept, decline, or withdraw trade offers
- Share contact details after an offer is accepted and confirm completion together

Accepting an offer reveals the sender's chosen contact method to the recipient. Traders arrange and complete the item exchange outside the hub. After both parties confirm completion, the hub transfers the listed items between their inventories and removes the fulfilled items from their wishlists. Accepting an offer or submitting only one completion confirmation does not change either user's lists.

Before deploying the offer workflow, apply `backend/migrations/002_trade_offers.sql` and `backend/migrations/003_offer_contact_completion.sql` to the database in order. Offers are stored separately from inventory and wishlist entries.