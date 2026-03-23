import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export async function GET() {
  return NextResponse.json({
    name: packageJson.name,
    version: packageJson.version,
    environment: process.env.NODE_ENV ?? "development",
  });
}
