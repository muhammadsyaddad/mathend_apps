use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyLemonSqueezyLicenseParams {
  pub product_id: String,
  pub api_base: String,
  pub license_key: String,
  pub increment_uses_count: Option<bool>,
}

#[derive(Deserialize, Serialize)]
#[serde(default)]
pub struct LemonSqueezyPurchase {
  pub email: Option<String>,
  pub sale_id: Option<String>,
  pub id: Option<String>,
  pub refunded: Option<bool>,
  pub disputed: Option<bool>,
  pub chargebacked: Option<bool>,
}

impl Default for LemonSqueezyPurchase {
  fn default() -> Self {
    Self {
      email: None,
      sale_id: None,
      id: None,
      refunded: None,
      disputed: None,
      chargebacked: None,
    }
  }
}

#[derive(Deserialize, Default)]
struct LemonSqueezyLicenseKey {
  id: Option<Value>,
  status: Option<String>,
}

#[derive(Deserialize, Default)]
struct LemonSqueezyLicenseMeta {
  product_id: Option<Value>,
  order_id: Option<Value>,
  order_item_id: Option<Value>,
  customer_email: Option<String>,
}

#[derive(Deserialize, Default)]
struct LemonSqueezyLicenseValidateResponse {
  valid: Option<bool>,
  error: Option<String>,
  license_key: Option<LemonSqueezyLicenseKey>,
  meta: Option<LemonSqueezyLicenseMeta>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum VerifyLemonSqueezyLicenseResult {
  Success(VerifyLemonSqueezyLicenseSuccess),
  Failure(VerifyLemonSqueezyLicenseFailure),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyLemonSqueezyLicenseSuccess {
  pub ok: bool,
  pub purchase: LemonSqueezyPurchase,
  pub sale_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyLemonSqueezyLicenseFailure {
  pub ok: bool,
  pub reason: String,
  pub message: String,
  pub status: Option<u16>,
}

fn normalize_api_base(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return "https://api.lemonsqueezy.com".to_string();
  }

  if trimmed.ends_with('/') {
    return trimmed.trim_end_matches('/').to_string();
  }

  trimmed.to_string()
}

fn normalize_license_status(value: Option<&str>) -> String {
  value.unwrap_or("").trim().to_lowercase()
}

fn to_id_string(value: Option<&Value>) -> String {
  match value {
    Some(Value::String(value)) => value.trim().to_string(),
    Some(Value::Number(value)) => value.to_string(),
    _ => "".to_string(),
  }
}

fn resolve_sale_id(
  meta: Option<&LemonSqueezyLicenseMeta>,
  license_key: Option<&LemonSqueezyLicenseKey>,
) -> String {
  if let Some(meta) = meta {
    let order_item_id = to_id_string(meta.order_item_id.as_ref());
    if !order_item_id.is_empty() {
      return order_item_id;
    }

    let order_id = to_id_string(meta.order_id.as_ref());
    if !order_id.is_empty() {
      return order_id;
    }
  }

  if let Some(license_key) = license_key {
    let license_key_id = to_id_string(license_key.id.as_ref());
    if !license_key_id.is_empty() {
      return license_key_id;
    }
  }

  "".to_string()
}

#[tauri::command]
pub async fn verify_lemonsqueezy_license(
  params: VerifyLemonSqueezyLicenseParams,
) -> Result<VerifyLemonSqueezyLicenseResult, String> {
  let product_id = params.product_id.trim().to_string();
  let license_key = params.license_key.trim().to_string();
  let api_base = normalize_api_base(&params.api_base);

  if product_id.is_empty() {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "Lemon Squeezy product id is missing.".to_string(),
        status: Some(400),
      }
      .into(),
    );
  }

  if license_key.is_empty() {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "License key is required.".to_string(),
        status: Some(400),
      }
      .into(),
    );
  }

  let endpoint = format!("{}/v1/licenses/validate", api_base);
  let body = vec![("license_key", license_key)];

  let client = reqwest::Client::new();
  let response = match client
    .post(endpoint)
    .header("Content-Type", "application/x-www-form-urlencoded")
    .form(&body)
    .send()
    .await
  {
    Ok(response) => response,
    Err(_) => {
      return Ok(
        VerifyLemonSqueezyLicenseFailure {
          ok: false,
          reason: "network".to_string(),
          message: "Could not reach Lemon Squeezy license API.".to_string(),
          status: None,
        }
        .into(),
      );
    }
  };

  let status = response.status().as_u16();
  let payload = response
    .json::<LemonSqueezyLicenseValidateResponse>()
    .await
    .unwrap_or_default();

  if status >= 400 || payload.valid != Some(true) || payload.license_key.is_none() {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: payload
          .error
          .unwrap_or_else(|| "License key is invalid for this product.".to_string()),
        status: Some(status),
      }
      .into(),
    );
  }

  let license_status = normalize_license_status(
    payload
      .license_key
      .as_ref()
      .and_then(|license_key| license_key.status.as_deref()),
  );

  if license_status == "disabled" || license_status == "expired" {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "revoked".to_string(),
        message:
          "License access is unavailable because this Lemon Squeezy license is disabled or expired."
            .to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  let verified_product_id = to_id_string(
    payload
      .meta
      .as_ref()
      .and_then(|meta| meta.product_id.as_ref()),
  );

  if verified_product_id.is_empty() {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "Lemon Squeezy validation did not include a product id.".to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  if verified_product_id != product_id {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "License key is invalid for this product.".to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  let sale_id = resolve_sale_id(payload.meta.as_ref(), payload.license_key.as_ref());
  if sale_id.is_empty() {
    return Ok(
      VerifyLemonSqueezyLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message:
          "Lemon Squeezy validation did not include a stable order identifier.".to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  let purchase = LemonSqueezyPurchase {
    email: payload
      .meta
      .as_ref()
      .and_then(|meta| meta.customer_email.as_ref())
      .map(|value| value.trim().to_lowercase())
      .filter(|value| !value.is_empty()),
    sale_id: Some(sale_id.clone()),
    id: payload
      .license_key
      .as_ref()
      .and_then(|license_key| license_key.id.as_ref())
      .and_then(|value| {
        let id = to_id_string(Some(value));
        if id.is_empty() {
          None
        } else {
          Some(id)
        }
      }),
    refunded: None,
    disputed: None,
    chargebacked: None,
  };

  Ok(
    VerifyLemonSqueezyLicenseSuccess {
      ok: true,
      purchase,
      sale_id,
    }
    .into(),
  )
}

impl From<VerifyLemonSqueezyLicenseSuccess> for VerifyLemonSqueezyLicenseResult {
  fn from(value: VerifyLemonSqueezyLicenseSuccess) -> Self {
    VerifyLemonSqueezyLicenseResult::Success(value)
  }
}

impl From<VerifyLemonSqueezyLicenseFailure> for VerifyLemonSqueezyLicenseResult {
  fn from(value: VerifyLemonSqueezyLicenseFailure) -> Self {
    VerifyLemonSqueezyLicenseResult::Failure(value)
  }
}
