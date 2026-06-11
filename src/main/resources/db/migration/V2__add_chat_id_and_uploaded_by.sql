-- chat_id links a session to the group chat where /newsplit was invoked
ALTER TABLE split_sessions ADD COLUMN chat_id BIGINT;

-- uploaded_by tracks who added an item (= who paid for it)
ALTER TABLE receipt_items ADD COLUMN uploaded_by UUID REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX idx_items_uploaded_by ON receipt_items(uploaded_by) WHERE uploaded_by IS NOT NULL;
