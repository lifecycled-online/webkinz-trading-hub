CREATE TABLE public.user_item_list_entries (
    issuer text NOT NULL,
    subject text NOT NULL,
    list_type text NOT NULL CHECK (list_type IN ('inventory', 'wishlist')),
    item_id text NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (issuer, subject, list_type, item_id)
);