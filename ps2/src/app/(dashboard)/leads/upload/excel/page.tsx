"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import Link from "next/link";
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

interface ParsedRow {
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
}

export default function ExcelUploadPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
      setRows(
        json.map((r) => ({
          first_name: r.first_name || r["First Name"] || "",
          last_name: r.last_name || r["Last Name"] || "",
          company: r.company || r["Company"] || "",
          email: r.email || r["Email"] || "",
          phone: r.phone || r["Phone"] || "",
        }))
      );
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleImport = async () => {
    setImporting(true);
    const formData = new FormData();
    formData.append("leads", JSON.stringify(rows));
    await fetch("/api/leads/upload/excel", { method: "POST", body: formData });
    setImporting(false);
    setRows([]);
  };

  return (
    <>
      <Header title="Upload Excel" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4">
          <Link href="/leads" className="text-sm text-[#1a237e] hover:underline">← Back to Leads</Link>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Drop Excel File</CardTitle></CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                isDragActive ? "border-[#ffc107] bg-amber-50" : "border-gray-300 hover:border-[#1a237e]"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-4 h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600">Drag & drop .xlsx, .xls, or .csv files</p>
            </div>
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> {rows.length} rows found
              </CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${rows.length} Leads`}
              </Button>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.first_name}</TableCell>
                      <TableCell>{r.last_name}</TableCell>
                      <TableCell>{r.company}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.phone}</TableCell>
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
