import { NextResponse } from "next/server"; 


type ConnectRequestBody = {
  providerId?: string;
};
export async function POST(request: Request) {
let body: ConnectRequestBody;
try {
  body = (await request.json()) as ConnectRequestBody;
} catch {
  return NextResponse.json(
    { error: "Invalid request payload." },
    { status: 400 },
  );
}
}

