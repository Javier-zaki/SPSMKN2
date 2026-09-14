import fs from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";

import { adminAuth, adminDb } from "../src/lib/firebase/admin";

function parseCsvLine(input: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeObject(headers: string[], values: string[]) {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    obj[header.trim()] = (values[index] ?? "").trim();
  });
  return obj;
}

function readCsv(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const csv = fs.readFileSync(absolutePath, "utf8");

  if (!csv.trim()) {
    throw new Error("CSV kosong.");
  }

  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV harus punya header dan minimal 1 baris data.");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => normalizeObject(headers, parseCsvLine(line)));

  return { headers, rows };
}

function readSpreadsheet(filePath: string) {
  const absolutePath = path.resolve(filePath);
  const workbook = XLSX.read(fs.readFileSync(absolutePath), { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number | boolean>>(sheet, {
    defval: "",
  });

  if (!rows.length) {
    throw new Error("File spreadsheet tidak berisi data.");
  }

  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
  ));
}

async function createAccount(opts: {
  username: string;
  email: string;
  password: string;
  role: "admin" | "petugas" | "siswa";
  name: string;
  extra?: Record<string, unknown>;
}) {
  const existing = await adminAuth
    .getUserByEmail(opts.email)
    .catch(() => null);

  const user =
    existing ??
    (await adminAuth.createUser({
      email: opts.email,
      password: opts.password,
      displayName: opts.name,
    }));

  if (existing) {
    console.log(`- Email sudah ada, memakai akun existing: ${opts.email}`);
  }

  await adminAuth.setCustomUserClaims(user.uid, {
    role: opts.role,
    ...(opts.extra?.unitId ? { unitId: String(opts.extra.unitId) } : {}),
  });

  const now = new Date().toISOString();
  const nowData = {
    uid: user.uid,
    role: opts.role,
    name: opts.name,
    email: opts.email,
    isActive: true,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
    ...opts.extra,
  };

  await adminDb.collection("users").doc(user.uid).set(nowData, { merge: true });
  await adminDb.collection("usernames").doc(opts.username).set({ email: opts.email });

  return user.uid;
}

function ensureRequired(row: Record<string, string>, required: string[]) {
  const missing = required.filter((field) => !String(row[field] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(`Field wajib tidak ada: ${missing.join(", ")}`);
  }
}

async function main() {
  const fileArg = process.argv.find((arg) => arg.startsWith("--file=")) ?? process.argv[process.argv.indexOf("--file") + 1];

  if (!fileArg || fileArg === "--file") {
    console.log("Usage: npm run import:users -- --file ./path/to/users.csv");
    console.log("Usage: npm run import:users -- --file ./path/to/users.xlsx");
    console.log("Contoh template: npm run import:users -- --file ./scripts/users-template.csv");
    process.exit(1);
  }

  const csvPath = fileArg;
  const fileExists = fs.existsSync(csvPath);
  if (!fileExists) {
    throw new Error(`File spreadsheet tidak ditemukan: ${csvPath}`);
  }

  const ext = path.extname(csvPath).toLowerCase();
  const rows = ext === ".xlsx" || ext === ".xls" ? readSpreadsheet(csvPath) : readCsv(csvPath).rows;
  if (rows.length === 0) {
    throw new Error("Tidak ada data untuk diimport.");
  }

  let created = 0;
  let skipped = 0;

  for (const [index, row] of rows.entries()) {
    try {
      const role = String(row.role ?? "").toLowerCase();
      if (!["siswa", "petugas"].includes(role)) {
        throw new Error(`Baris ${index + 2}: role harus 'siswa' atau 'petugas'.`);
      }

      const username = String(row.username ?? "").trim();
      const email = String(row.email ?? "").trim();
      const name = String(row.name ?? "").trim();
      const password = String(row.password ?? "").trim();

      if (role === "siswa") {
        ensureRequired(row, ["role", "username", "email", "name", "password", "nis", "className"]);
        const usernameTaken = await adminDb.collection("usernames").doc(username).get();
        if (usernameTaken.exists) {
          console.log(`- Lewati baris ${index + 2}: username sudah dipakai (${username})`);
          skipped += 1;
          continue;
        }

        await createAccount({
          username,
          email,
          password,
          role: "siswa",
          name,
          extra: {
            nis: row.nis,
            className: row.className,
          },
        });
      } else {
        ensureRequired(row, ["role", "username", "email", "name", "password", "unitId"]);
        const usernameTaken = await adminDb.collection("usernames").doc(username).get();
        if (usernameTaken.exists) {
          console.log(`- Lewati baris ${index + 2}: username sudah dipakai (${username})`);
          skipped += 1;
          continue;
        }

        await createAccount({
          username,
          email,
          password,
          role: "petugas",
          name,
          extra: {
            unitId: row.unitId,
            position: row.position ?? "",
          },
        });
      }

      created += 1;
      console.log(`✓ Baris ${index + 2}: ${role} dibuat (${email})`);
    } catch (error) {
      console.error(`✗ Baris ${index + 2}: ${(error as Error).message}`);
      skipped += 1;
    }
  }

  console.log(`\nSelesai. Dibuat: ${created}, dilewati: ${skipped}`);
}

main().catch((error) => {
  console.error("[import-users]", error);
  process.exit(1);
});
