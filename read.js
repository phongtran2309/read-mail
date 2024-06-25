import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';

// Đọc tệp account.txt và tách thành các cặp username và password
const accounts = fs.readFileSync('./accounts.txt',
  {encoding: 'utf8', flag: 'r'}).trim().replace(/(\r|\r)/gm, "").split('\n').map(line => line.split('|'));

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
                const filename = `email_${username}.txt`;
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
                      console.log(`No 6-digit number found for ${username}`);
                    }
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

// Lặp qua từng tài khoản và thực hiện fetchEmails
accounts.forEach(([username, password]) => {
  if (username && password) {
    fetchEmails(username, password);
  }
});
