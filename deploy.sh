echo "Deploying..."

scp -i "D:\Cikampek\Daerah Cikampek\Proyek KBM\Absensi Pengajian\Deploy\BiznetGio\SSH\admin.pem" -r * mbrillian354@103.127.133.63:/var/www/ppg-cikampek

echo "Deploy successfull!"
