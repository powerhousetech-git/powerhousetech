"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

interface ParsedLead {
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
  selected: boolean;
}

export default function BusinessCardUploadPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(accepted);
    setParsed(
      accepted.map((f, i) => ({
        first_name: `Contact`,
        last_name: `${i + 1}`,
        company: f.name.replace(/\.[^.]+$/, ""),
        email: `contact${i + 1}@example.com`,
        phone: "",
        selected: true,
      }))
    );
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg"], "application/pdf": [".pdf"] },
  });

  const handleImport = async () => {
    setImporting(true);
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    const selected = parsed.filter((p) => p.selected);
    formData.append("leads", JSON.stringify(selected));

    await fetch("/api/leads/upload/business-card", {
      method: "POST",
      body: formData,
    });
    setImporting(false);
    setFiles([]);
    setParsed([]);
  };

  return (
    <>
      <Header title="Upload Business Cards" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <Link href="/leads" className="text-sm text-[#1a237e] hover:underline">← Back to Leads</Link>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Drop Business Cards</CardTitle></CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                isDragActive ? "border-[#ffc107] bg-amber-50" : "border-gray-300 hover:border-[#1a237e]"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-4 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600">
                {isDragActive ? "Drop files here..." : "Drag & drop business card images or PDFs"}
              </p>
            </div>
            {files.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {files.map((f) => (
                  <div key={f.name} className="flex items-center gap-2 rounded bg-gray-100 px-3 py-1 text-sm">
                    <FileImage className="h-4 w-4" /> {f.name}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {parsed.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Review Extracted Data</CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${parsed.filter((p) => p.selected).length} Leads`}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.company}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.phone || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
