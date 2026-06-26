CREATE TABLE `gaap_daily_metrics` (
	`node` text NOT NULL,
	`date` text NOT NULL,
	`store_name` text,
	`turnover` real DEFAULT 0 NOT NULL,
	`turnover_excl` real DEFAULT 0 NOT NULL,
	`cost_of_sales` real DEFAULT 0 NOT NULL,
	`gross_profit` real DEFAULT 0 NOT NULL,
	`voids` real DEFAULT 0 NOT NULL,
	`wastage` real DEFAULT 0 NOT NULL,
	`shrinkage` real DEFAULT 0 NOT NULL,
	`transaction_count` integer DEFAULT 0 NOT NULL,
	`avg_spend` real DEFAULT 0 NOT NULL,
	`channel_breakdown` text,
	`department_breakdown` text,
	`synced_at` integer NOT NULL,
	PRIMARY KEY(`node`, `date`)
);
