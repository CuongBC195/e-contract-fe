# E-Contract Frontend

Frontend cho hệ thống quản lý hợp đồng và hóa đơn điện tử.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Rich Text Editor**: TipTap
- **PDF Generation**: jsPDF + html2canvas
- **Signature**: react-signature-canvas

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update the values in `.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel

1. Import project to Vercel
2. Add environment variables:
   - `NEXT_PUBLIC_BACKEND_URL`: Your backend API URL
   - `NEXT_PUBLIC_BASE_URL`: Your Vercel domain
3. Deploy

## Features

- ✅ Tạo và quản lý hợp đồng/hóa đơn
- ✅ Chữ ký điện tử (vẽ tay / nhập text)
- ✅ Xuất PDF
- ✅ Chia sẻ link ký online
- ✅ Audit trail (lịch sử ký)
- ✅ Admin dashboard
- ✅ User authentication

## License

Private
