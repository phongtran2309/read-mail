import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';

// Thông tin đăng nhập
const username = 'akoteykcira@outlook.com';
const password = 'xQGotDtdMU12Kf';

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
    //UNSEEN or ALL
    imap.search(['ALL'], function(err, results) {
      if (err) throw err;
      const latestEmail = results[results.length - 1];
      if (latestEmail) {
        const f = imap.fetch(latestEmail, { bodies: '' });
        f.on('message', function(msg, seqno) {
          msg.on('body', function(stream, info) {
            simpleParser(stream, (err, parsed) => {
              if (err) throw err;
              const subject = `Subject: ${parsed.subject}\n`;
              const body = `Body: ${parsed.text}\n`;

              // Ghi kết quả vào file email.txt
              fs.appendFileSync('email.txt', subject + body, (err) => {
                if (err) throw err;
                console.log('Email content written to email.txt');
              });
            });
          });
        });
        f.once('error', function(err) {
          console.log('Fetch error: ' + err);
        });
        f.once('end', function() {
          console.log('Done fetching all messages!');
          imap.end();
        });
      }
    });
  });
});
