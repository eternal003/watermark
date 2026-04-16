import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watermark Studio - 로고 워터마크 생성기",
  description: "이미지에 로고 워터마크를 쉽고 빠르게 추가하세요. 크기, 간격, 패턴 등 다양한 설정을 지원합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
