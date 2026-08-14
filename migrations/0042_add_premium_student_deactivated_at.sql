-- F3.4.2: durable, product-scoped Premium deactivation timestamp.
ALTER TABLE premium_students ADD COLUMN deactivated_at TEXT NULL;

