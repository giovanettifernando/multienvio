This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database connectivity & health checks

- Configure the database through the `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_SCHEMA` variables. A `DATABASE_URL` value is generated automatically at runtime when it is not provided. See `.env.local.example` for Docker (`DB_HOST=db`) and local (`DB_HOST=localhost`) profiles.
- Use `GET /api/health/db` to verify connectivity; it returns `200` when the database answers and `503` when it is offline.
- When the application successfully connects it runs `npx prisma migrate status` and logs the outcome. If pending migrations are reported, run `npx prisma migrate deploy`.
- Requests fail fast with `503 service_unavailable` while the database is unreachable and `503 schema_out_of_date` when required tables are missing. The server attempts to reconnect automatically once the database comes back.
