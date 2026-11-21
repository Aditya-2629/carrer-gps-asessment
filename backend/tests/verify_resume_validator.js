import { validateResumeContent, ResumeValidationError } from '../agents/resume/validation/resumeContentValidator.js'
import assert from 'assert'

console.log('Testing validateResumeContent...')

// 1. Scanned or empty
const emptyRes = validateResumeContent('')
assert.strictEqual(emptyRes.valid, false)
assert.strictEqual(emptyRes.code, 'SCANNED_OR_EMPTY_FILE')

const shortRes = validateResumeContent('Hello world this is too short.')
assert.strictEqual(shortRes.valid, false)
assert.strictEqual(shortRes.code, 'SCANNED_OR_EMPTY_FILE')

// 2. Real resume with Experience, Education, Skills, Contact
const validResumeText = `
Deepanjan Datta
Senior AI & Full Stack Engineer | deepanjan@example.com | (555) 123-4567 | linkedin.com/in/deepanjan
Summary
Senior Software Engineer with 8+ years experience building scalable distributed systems and LLM applications.

Experience
Staff Software Engineer | Acme Corp (June 2021 – Present)
- Architected enterprise cloud infrastructure handling 50M requests daily.
- Built real-time LLM telemetry pipeline reducing query latency by 45%.

Software Engineer | Beta Tech (June 2018 – May 2021)
- Developed REST microservices with Node.js and PostgreSQL.

Education
Bachelor of Technology in Computer Science | Delhi Technological University (2014 – 2018)

Skills
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, Kubernetes, SQL, Git
`
const validRes = validateResumeContent(validResumeText)
assert.strictEqual(validRes.valid, true)
assert.ok(validRes.positiveSignalsCount >= 4)
console.log('✓ Valid resume passed:', validRes.positiveSignalsCount, 'signals')

// 3. Obvious Invoice
const invoiceText = `
TAX INVOICE
Invoice Number: INV-2024-9981
Invoice Date: October 14, 2024
Bill To: John Doe, 123 Main Street, Springfield
Payment Due: October 28, 2024
Items Ordered:
1. Ergonomic Chair - $350.00
2. Desk Mat - $45.00
Subtotal: $395.00
Tax: $31.60
Total Amount Due: $426.60
Payment Method: Visa ending in 4111. Remit to: Accounts Receivable, Corp Inc.
`
const invoiceRes = validateResumeContent(invoiceText)
assert.strictEqual(invoiceRes.valid, false)
assert.strictEqual(invoiceRes.code, 'NOT_A_RESUME')
console.log('✓ Invoice rejected:', invoiceRes.code)

// 4. Bank Statement
const bankText = `
NATIONAL FIRST BANK - ACCOUNT STATEMENT
Statement Period: 09/01/2024 - 09/30/2024
Account Number: 9876543210
Opening Balance: $12,450.00
Total Deposits: $4,200.00
Total Withdrawals: $3,150.00
Closing Balance: $13,500.00
Available Balance: $13,500.00
Transaction History:
09/05 Direct Deposit ACME CORP $2,100.00
09/12 Grocery Store -$125.00
09/19 Electric Utility Bill -$85.00
`
const bankRes = validateResumeContent(bankText)
assert.strictEqual(bankRes.valid, false)
assert.strictEqual(bankRes.code, 'NOT_A_RESUME')
console.log('✓ Bank statement rejected:', bankRes.code)

// 5. Boarding pass / flight ticket
const flightText = `
AIRLINE BOARDING PASS / E-TICKET RECEIPT
Passenger Name: Smith / Robert MR
Booking Reference (PNR): X7Y8Z9
Flight Number: AA 1842
Date: 12 Nov 2024
Depart: New York (JFK) Terminal 8 - Gate: B22
Arrive: London (LHR) Terminal 5
Seat: 14B - Class: Economy
Please be at the boarding gate at least 45 minutes prior to departure.
`
const flightRes = validateResumeContent(flightText)
assert.strictEqual(flightRes.valid, false)
assert.strictEqual(flightRes.code, 'NOT_A_RESUME')
console.log('✓ Boarding pass rejected:', flightRes.code)

// 6. Legal lease agreement
const leaseText = `
RESIDENTIAL LEASE AGREEMENT
This agreement is made and entered into this 1st day of January, 2024, by and between Landlord, Apex Properties LLC (Lessor), and Tenant, Jane Roe (Lessee).
The parties hereto agree to the following terms and conditions:
1. Premises: Apartment 4B, 100 Sunset Blvd.
2. Term: The tenancy shall commence on Feb 1, 2024 and end on Jan 31, 2025.
3. Rent: Tenant agrees to pay $2,200 per month on or before the first day of each calendar month.
`
const leaseRes = validateResumeContent(leaseText)
assert.strictEqual(leaseRes.valid, false)
assert.strictEqual(leaseRes.code, 'NOT_A_RESUME')
console.log('✓ Legal lease rejected:', leaseRes.code)

// 7. Random essay / text
const essayText = `
The Impact of Urbanization on Avian Migration Patterns in Western North America
Urban sprawl continues to transform native habitats across the Pacific Northwest. In this paper, we explore how highway noise and artificial lighting disrupt nocturnal avian navigation. Field data was collected across 14 observation posts over three consecutive autumn seasons. Our findings suggest that species relying on celestial navigation alter their flight corridors by an average of 18 kilometers when approaching major metropolitan centers. Further research is required to evaluate long-term population sustainability.
`
const essayRes = validateResumeContent(essayText)
assert.strictEqual(essayRes.valid, false)
assert.strictEqual(essayRes.code, 'NOT_A_RESUME')
console.log('✓ Essay rejected:', essayRes.code)

console.log('All validateResumeContent tests passed successfully!')
