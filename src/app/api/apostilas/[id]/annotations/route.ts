import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/app/actions/auth";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apostilaId = params.id;

    const annotations = await prisma.apostilaAnnotation.findMany({
      where: {
        userId: user.userId,
        apostilaId
      }
    });

    return NextResponse.json(annotations);
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apostilaId = params.id;
    const body = await req.json();

    const annotation = await prisma.apostilaAnnotation.create({
      data: {
        userId: user.userId,
        apostilaId,
        content: body.content,
        highlightData: body.highlightData,
        color: body.color || "yellow"
      }
    });

    return NextResponse.json(annotation);
  } catch (error) {
    console.error("Error creating annotation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const annotationId = url.searchParams.get("annotationId");

    if (!annotationId) {
      return NextResponse.json({ error: "Missing annotationId" }, { status: 400 });
    }

    const annotation = await prisma.apostilaAnnotation.findUnique({
      where: { id: annotationId }
    });

    if (!annotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (annotation.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.apostilaAnnotation.delete({
      where: { id: annotationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting annotation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
