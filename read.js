import fs from 'fs';
import { Worker, isMainThread, workerData } from 'worker_threads';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import path from 'path';

if (isMainThread) {
  // Main thread logic
  // Đọc tệp account.txt và tách thành các cặp username và password
  const accounts = fs.readFileSync('./accounts.txt', { encoding: 'utf8', flag: 'r' })
    .trim()
    .replace(/(\r|\r)/gm, "")
    .split('\n')
    .map(line => line.split('|'));

  // Tạo thư mục result nếu chưa tồn tại
  if (!fs.existsSync('result')) {
    fs.mkdirSync('result');
  }

  // Hàm tạo và khởi chạy worker cho mỗi tài khoản
  function startWorkers(accounts) {
    const promises = [];
    for (const [username, password] of accounts) {
      if (username && password) {
        const promise = new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), {
            workerData: { username, password }
          });

          worker.on('message', resolve);
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`Worker stopped with exit code ${code}`));
            }
          });
        });
        promises.push(promise);
      }
    }
    return Promise.all(promises);
  }

  // Gọi hàm startWorkers để bắt đầu xử lý các tài khoản
  startWorkers(accounts)
    .then(() => {
      console.log('All accounts processed.');
    })
    .catch((err) => {
      console.error('Error processing accounts:', err);
    });
} else {
  // Worker thread logic
  // Lấy dữ liệu từ workerData
  const { username, password } = workerData;

  // Hàm xử lý email
  function fetchEmails(username, password) {
    // Cấu hình IMAP
    const imap = new Imap({
      user: username,
      password: password,
      host: 'imap-mail.outlook.com',
      port: 993,
      tls: true
    });

    // Hàm mở hộp thư
    function openInbox(cb) {
      imap.openBox('INBOX', true, cb);
    }

    // Sự kiện khi có lỗi
    imap.once('error', function(err) {
      console.log(err);
      process.exit(1); // Thoát worker với mã lỗi 1
    });

    // Sự kiện khi đóng kết nối
    imap.once('end', function() {
      console.log('Connection ended');
    });

    // Kết nối đến máy chủ IMAP
    imap.connect();

    // Sự kiện khi đã sẵn sàng
    imap.once('ready', function() {
      openInbox(function(err, box) {
        if (err) throw err;
        imap.search(['UNSEEN'], function(err, results) {
          if (err) throw err;
          if (results.length > 0) {
            const lastEmail = results[results.length - 1]; // Lấy email cuối cùng từ danh sách kết quả
            const f = imap.fetch(lastEmail, { bodies: '' });
            f.on('message', function(msg, seqno) {
              msg.on('body', function(stream, info) {
                simpleParser(stream, (err, parsed) => {
                  if (err) throw err;
                  const subject = `Subject: ${parsed.subject}\n`;
                  const body = `Body: ${parsed.text}\n`;

                  // Ghi kết quả vào file email.txt
                  const filename = path.join('result', `email_${username}.txt`);
                  fs.writeFile(filename, subject + body, (err) => {
                    if (err) throw err;
                    console.log(`Email content written to ${filename}`);

                    // Đọc nội dung file và tìm chuỗi gồm 6 ký tự số
                    fs.readFile(filename, 'utf8', (err, data) => {
                      if (err) throw err;
                      const regex = /\b\d{6}\b/;
                      const match = data.match(regex);
                      if (match) {
                        console.log(`----------Found 6-digit number for ${username}:`, match[0]);
                      } else {
                        console.log(`----------No 6-digit number found for ${username}`);
                      }
                      imap.end();
                    });
                  });
                });
              });
            });
            f.once('error', function(err) {
              console.log('Fetch error: ' + err);
            });
            f.once('end', function() {
              console.log('Done fetching the message!');
              imap.end();
            });
          } else {
            console.log('No unread emails found.');
            imap.end();
          }
        });
      });
    });
  }

  // Bắt đầu xử lý email
  fetchEmails(username, password);
}
