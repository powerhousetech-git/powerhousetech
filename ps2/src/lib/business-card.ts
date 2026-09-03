export interface ExtractedContact {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
}

function mockFromFilename(filename: string): ExtractedContact[] {
  const base = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? 'John';
  const last = parts[1] ?? 'Doe';
  const company = parts.slice(2).join(' ') || 'Acme Corp';

  return [
    {
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      company,
      designation: 'Director',
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      phone: '+1 555-0100',
      website: `https://www.${company.toLowerCase().replace(/\s+/g, '')}.com`,
    },
  ];
}

async function extractWithClaude(
  pdfBuffer: Buffer,
  filename: string
): Promise<ExtractedContact[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockFromFilename(filename);
  }

  const base64 = pdfBuffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract all business card contacts from this PDF. Return ONLY a JSON array of objects with fields: first_name, last_name, full_name, company, designation, email, phone, website. Filename: ${filename}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return mockFromFilename(filename);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return mockFromFilename(filename);
  }

  try {
    return JSON.parse(jsonMatch[0]) as ExtractedContact[];
  } catch {
    return mockFromFilename(filename);
  }
}

export async function extractBusinessCardContacts(
  input: { pdfBuffer?: Buffer; filename: string; mockContacts?: ExtractedContact[] }
): Promise<ExtractedContact[]> {
  if (input.mockContacts) {
    return input.mockContacts;
  }

  if (input.pdfBuffer && process.env.ANTHROPIC_API_KEY) {
    return extractWithClaude(input.pdfBuffer, input.filename);
  }

  return mockFromFilename(input.filename);
}
