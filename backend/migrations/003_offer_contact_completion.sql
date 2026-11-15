ALTER TABLE public.trade_offers
    ADD COLUMN contact_method text NOT NULL DEFAULT 'other',
    ADD COLUMN contact_value text NOT NULL DEFAULT '',
    ADD COLUMN sender_completed_at timestamptz,
    ADD COLUMN recipient_completed_at timestamptz,
    ADD CONSTRAINT trade_offers_contact_method_check
        CHECK (contact_method IN ('discord', 'email', 'other')),
    ADD CONSTRAINT trade_offers_contact_value_length_check
        CHECK (char_length(contact_value) <= 200);

ALTER TABLE public.trade_offers
    DROP CONSTRAINT trade_offers_status_check,
    ADD CONSTRAINT trade_offers_status_check
        CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'completed'));