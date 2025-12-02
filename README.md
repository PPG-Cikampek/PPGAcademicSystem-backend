# PPGAcademicSystem-backend

## Account Requests With Profile Images
You can now include profile images when requesting new student or teacher accounts.

Endpoint: `POST /api/users/requestAccounts`

Content-Type: `multipart/form-data`

Form Fields:
- `subBranchId` (string, required) – Target SubBranch ObjectId.
- `accountList` (string, required) – JSON.stringify of an array of account objects:
	```json
	[
		{
			"name": "Nama Lengkap",
			"accountRole": "student",
			"dateOfBirth": "2025-09-12"
		},
		{
			"name": "Guru Baru",
			"accountRole": "teacher",
			"email": "guru@example.com",
			"dateOfBirth": "1990-01-01"
		}
	]
	```
	Fields per object:
	- `name` (required)
	- `accountRole` (`student` | `teacher`, required)
	- `email` (required for teacher accounts)
	- `dateOfBirth` (optional)

File Uploads:
- `images` – one file per account in the exact same order as in `accountList`.
	- Supported mime types: jpg, jpeg, png.
	- Max size per file: 1MB (see multer config).

Processing:
1. Uploaded images are stored and their paths + thumbnails are embedded into each account object in the ticket.
2. When an admin approves all pending tickets (`POST /api/users/account-requests/approve-all`), the system creates corresponding `User`, and `Student` or `Teacher` documents, copying over `image` and `thumbnail` fields.

Response:
```json
{ "message": "Berhasil membuat permintaan!", "ticketId": "..." }
```

Notes:
- If fewer images are uploaded than accounts, trailing accounts will have no image.
- Thumbnails are generated best-effort; failures won't block the request.
 
