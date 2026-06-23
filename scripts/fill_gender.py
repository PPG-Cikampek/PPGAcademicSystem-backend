"""
Fill gender (L/P) column in all -fix.xlsx files from source .xlsx files.
Match by NIS. Insert gender column if missing (shift Ukuran Baju to col 8).
"""
import sys, os, openpyxl

SRC_DIR = r'scripts/output'

pairs = [
    ('Cikampek Barat.xlsx', 'Cikampek Barat-fix.xlsx'),
    ('Cikampek Tengah.xlsx', 'Cikampek Tengah-fix.xlsx'),
    ('Cikampek Timur.xlsx', 'Cikampek Timur-fix.xlsx'),
    ('Cilamaya.xlsx', 'Cilamaya-fix.xlsx'),
    ('Jatiluhur.xlsx', 'Jatiluhur-fix.xlsx'),
    ('Purwakarta 1.xlsx', 'Purwakarta 1-fix.xlsx'),
    ('Purwakarta 2.xlsx', 'Purwakarta 2-fix.xlsx'),
]

def ensure_gender_column(ws):
    """If col 7 header is not L/P/Jenis Kelamin, insert gender column."""
    h7 = ws.cell(1, 7).value
    if h7 and str(h7).strip().lower() in ('l/p', 'jenis kelamin', 'l/p'):
        return False  # already has gender col
    # Shift col 7 → col 8 for all rows with data
    max_col = ws.max_column
    for r in range(1, ws.max_row + 1):
        val = ws.cell(r, 7).value
        if val is not None:
            ws.cell(r, 8).value = val
            ws.cell(r, 7).value = None
    ws.cell(1, 7).value = 'L/P'
    return True

total_all = 0
for src_fn, tgt_fn in pairs:
    src_path = os.path.join(SRC_DIR, src_fn)
    tgt_path = os.path.join(SRC_DIR, tgt_fn)
    if not os.path.exists(tgt_path):
        print(f'SKIP: {tgt_fn} not found')
        continue

    wb_src = openpyxl.load_workbook(src_path)
    wb_tgt = openpyxl.load_workbook(tgt_path)

    sheet_map = {}
    for t_sn in wb_tgt.sheetnames:
        if t_sn.startswith('Copy of '):
            base = t_sn[8:]
            if base in wb_src.sheetnames:
                sheet_map[t_sn] = base
                continue
        if t_sn in wb_src.sheetnames:
            sheet_map[t_sn] = t_sn

    pair_filled = 0
    for t_sn, s_sn in sheet_map.items():
        ws_tgt = wb_tgt[t_sn]
        ws_src = wb_src[s_sn]

        # Insert gender column if missing
        inserted = ensure_gender_column(ws_tgt)

        # Build NIS→gender from source
        nis_map = {}
        for r in range(2, ws_src.max_row + 1):
            nis = ws_src.cell(r, 3).value
            gender = str(ws_src.cell(r, 7).value or '').strip()
            if nis is not None and gender:
                nis_map[str(nis).strip()] = gender

        filled = 0
        for r in range(2, ws_tgt.max_row + 1):
            name = ws_tgt.cell(r, 2).value
            if not name or not str(name).strip():
                continue
            nis = str(ws_tgt.cell(r, 3).value or '').strip()
            if not nis:
                continue
            existing = str(ws_tgt.cell(r, 7).value or '').strip()
            if existing and existing != 'None':
                continue
            if nis in nis_map:
                ws_tgt.cell(r, 7).value = nis_map[nis]
                filled += 1

        pair_filled += filled
        print(f'  {t_sn}: +{filled} genders (col{" inserted" if inserted else " existed"})')

    wb_tgt.save(tgt_path)
    print(f'{tgt_fn}: {pair_filled} total filled\n')
    total_all += pair_filled

print(f'DONE. {total_all} genders filled across all files.')
