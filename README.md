## PAM Shortcut Launcher (Next.js)

Aplikasi frontend mirip “PAM launcher” untuk menyimpan daftar shortcut host (RDP/SSH) dan **generate file shortcut `.bat`** untuk login cepat ke IP tertentu di Windows.

### Fitur

- **CRUD profil**: nama, host/IP, jenis (RDP/SSH), opsi port/username (SSH), fullscreen/admin (RDP)
- **Persist lokal** via `localStorage`
- **Download `.bat`** per profil atau gabungan “Download semua”
- **Opsional**: konversi `.bat` → `.exe` (PowerShell `ps2exe`)

### Menjalankan (Dev)

```bash
cd pam-shortcut
npm run dev
```

Buka `http://localhost:3000`.

### Output `.bat` (yang di-generate)

- **RDP**: pakai `mstsc.exe` dengan argumen `/v:<host> /prompt` + opsi `/f` (fullscreen) dan `/admin`
- **SSH**: pakai `ssh.exe` (Windows OpenSSH) dengan `ssh -p <port> <user@host>`

### (Opsional) Convert `.bat` → `.exe` di Windows

Kalau butuh output `.exe`, kamu bisa convert file `.bat` hasil download memakai script `tools/bat-to-exe.ps1`.

1) Install module `ps2exe` (sekali saja):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
Install-Module ps2exe -Scope CurrentUser -Force
```

2) Convert:

```powershell
.\tools\bat-to-exe.ps1 -BatPath .\pam_xxx.bat -OutExe .\pam_xxx.exe
```

Catatan: Hasil `.exe` pada dasarnya “wrapper” yang menjalankan isi batch.
