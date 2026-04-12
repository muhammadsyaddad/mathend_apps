mod license;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![license::verify_gumroad_license])
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_sql::Builder::new().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
