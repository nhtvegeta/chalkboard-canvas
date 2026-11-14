# Hướng dẫn build file APK / AAB đưa lên Google Play Store

Dự án đã được tích hợp sẵn toàn bộ mã nguồn Native Android (`Capacitor Android`) tại thư mục `android/`.

## Cách 1: Xuất file APK trực tiếp qua Android Studio (Khuyên dùng & Dễ nhất)

1. Tải và cài đặt **[Android Studio](https://developer.android.com/studio)** (nếu máy tính của bạn chưa có).
2. Mở Android Studio > Chọn **Open** > Trỏ tới thư mục:
   ```
   d:\My project\Big board\android
   ```
3. Đợi Android Studio đồng bộ Gradle (sync) khoảng 1 - 2 phút.
4. **Để test trên điện thoại Android:**
   - Cắm cáp điện thoại vào máy tính (bật *Gỡ lỗi USB / USB Debugging* trên điện thoại) > Nhấn nút **Run** (hình tam giác xanh) trên Android Studio.
   - **HOẶC** trên thanh menu chọn: `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
   - File APK xuất ra tại: `android/app/build/outputs/apk/debug/app-debug.apk`. Bạn chỉ cần copy file này sang điện thoại và cài đặt.

5. **Để đóng gói bán trên CH Play (Google Play Store):**
   - Trên menu Android Studio chọn: `Build` > `Generate Signed Bundle / APK...`
   - Chọn **Android App Bundle (.aab)** > Nhấn `Next`.
   - Chọn hoặc tạo Keystore (chìa khóa ký ứng dụng).
   - Chọn biến thể `release` > Nhấn `Create`.
   - File `.aab` được tạo xong bạn chỉ việc tải lên Google Play Console!

---

## Cách 2: Test tức thì trên điện thoại qua mạng Wi-Fi (Không cần cài APK)

Máy chủ Production của bảng đen đang mở tại mạng nội bộ:
```
http://192.168.196.142:5173/
```
1. Kết nối điện thoại cùng mạng Wi-Fi với máy tính.
2. Mở trình duyệt Chrome trên điện thoại và truy cập địa chỉ trên.
3. Bấm vào menu 3 chấm trên Chrome > Chọn **"Thêm vào màn hình chính" (Add to Home screen)** hoặc **"Cài đặt ứng dụng"**.
4. Ứng dụng sẽ hoạt động full màn hình như một App native độc lập!
