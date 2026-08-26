#!/bin/bash
set -e

MAIN_BRANCH="feat/custom-ui-for-cde"
WIP_BRANCH="wip"

show_menu() {
    echo "=================================================="
    echo "🚀 GIT WIP SYNC HELPER - ĐỒNG BỘ CODE GIỮA 2 MÁY"
    echo "   (Nhánh chính: $MAIN_BRANCH | Nhánh nháp: $WIP_BRANCH)"
    echo "=================================================="
    echo "1) [LƯU NHÁP]  Lưu toàn bộ thay đổi và đẩy lên GitHub"
    echo "2) [TẢI NHÁP]  Kéo toàn bộ thay đổi từ GitHub về máy này"
    echo "3) [HOÀN TẤT]  Gộp tất cả nháp (Squash) vào '$MAIN_BRANCH'"
    echo "4) Thoát"
    echo "=================================================="
    read -p "Vui lòng chọn (1-4): " choice
    case $choice in
        1) save_wip ;;
        2) load_wip ;;
        3) finish_wip ;;
        4) exit 0 ;;
        *) echo "Lựa chọn không hợp lệ!"; exit 1 ;;
    esac
}

save_wip() {
    echo ""
    echo "📦 [1/3] Đang chuyển sang nhánh nháp '$WIP_BRANCH'..."
    git checkout -B "$WIP_BRANCH"
    
    echo "📝 [2/3] Đang gom và commit nháp..."
    git add -A
    # Commit nếu có thay đổi
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        git commit -m "wip: sync $(date '+%Y-%m-%d %H:%M:%S')" --no-verify
    else
        echo "   (Không có file mới thay đổi, tiếp tục push)"
    fi
    
    echo "☁️  [3/3] Đang đẩy lên GitHub (origin/$WIP_BRANCH)..."
    git push origin "$WIP_BRANCH" --force
    echo ""
    echo "✅ XONG! Code dở dang đã được lưu trên mây. Bạn có thể sang máy khác code tiếp."
}

load_wip() {
    echo ""
    echo "📥 [1/2] Đang tải nhánh '$WIP_BRANCH' mới nhất từ GitHub..."
    git fetch origin "$WIP_BRANCH"
    
    echo "🔄 [2/2] Đang cập nhật workspace trên máy..."
    git checkout -B "$WIP_BRANCH" origin/"$WIP_BRANCH"
    git reset --hard origin/"$WIP_BRANCH"
    echo ""
    echo "✅ XONG! Toàn bộ code dở dang từ máy trước đã được nạp vào máy này."
}

finish_wip() {
    echo ""
    read -p "Nhập nội dung commit chính thức (Ví dụ: feat: hoàn thiện form cde): " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        echo "❌ Nội dung commit không được để trống!"
        exit 1
    fi
    
    echo "🔀 [1/4] Đang chuyển về nhánh chính '$MAIN_BRANCH' và đồng bộ từ GitHub..."
    git checkout "$MAIN_BRANCH"
    git fetch origin "$MAIN_BRANCH" 2>/dev/null || true
    if git rev-parse --verify origin/"$MAIN_BRANCH" >/dev/null 2>&1; then
        git reset --hard origin/"$MAIN_BRANCH"
    fi
    
    echo "🧹 [2/4] Đang nạp toàn bộ mã nguồn mới nhất từ '$WIP_BRANCH'..."
    git checkout "$WIP_BRANCH" -- .
    
    # Xoá các file đã bị xoá trên nhánh wip (nếu có)
    deleted_files=$(git diff --name-only --diff-filter=D HEAD "$WIP_BRANCH" 2>/dev/null || true)
    if [ -n "$deleted_files" ]; then
        echo "$deleted_files" | xargs git rm -f 2>/dev/null || true
    fi
    
    git add -A
    
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "   (Không có thay đổi mới, tiếp tục)"
    else
        echo "📝 [3/4] Đang tạo commit chính thức..."
        git commit -m "$COMMIT_MSG"
    fi
    
    echo "🚀 [4/4] Đang đẩy commit chính thức lên GitHub..."
    git push origin "$MAIN_BRANCH"
    echo ""
    echo "🎉 HOÀN THÀNH XUẤT SẮC! Đã đồng bộ 1 commit sạch đẹp lên '$MAIN_BRANCH'."
}

# Hỗ trợ chạy trực tiếp tham số dòng lệnh: ./sync_wip.sh save | load | finish
case "$1" in
    save|push) save_wip ;;
    load|pull) load_wip ;;
    finish|merge) finish_wip ;;
    *) show_menu ;;
esac
