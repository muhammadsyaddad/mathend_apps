use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyGumroadLicenseParams {
  pub product_id: String,
  pub api_base: String,
  pub license_key: String,
  pub increment_uses_count: Option<bool>,
}

#[derive(Deserialize, Serialize)]
#[serde(default)]
pub struct GumroadPurchase {
  pub email: Option<String>,
  pub sale_id: Option<String>,
  pub id: Option<String>,
  pub refunded: Option<bool>,
  pub disputed: Option<bool>,
  pub chargebacked: Option<bool>,
}

impl Default for GumroadPurchase {
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

#[derive(Deserialize)]
#[serde(default)]
struct GumroadLicenseVerifyResponse {
  success: Option<bool>,
  purchase: Option<GumroadPurchase>,
  message: Option<String>,
}

impl Default for GumroadLicenseVerifyResponse {
  fn default() -> Self {
    Self {
      success: None,
      purchase: None,
      message: None,
    }
  }
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum VerifyGumroadLicenseResult {
  Success(VerifyGumroadLicenseSuccess),
  Failure(VerifyGumroadLicenseFailure),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyGumroadLicenseSuccess {
  pub ok: bool,
  pub purchase: GumroadPurchase,
  pub sale_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyGumroadLicenseFailure {
  pub ok: bool,
  pub reason: String,
  pub message: String,
  pub status: Option<u16>,
}

fn normalize_api_base(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return "https://api.gumroad.com".to_string();
  }

  if trimmed.ends_with('/') {
    return trimmed.trim_end_matches('/').to_string();
  }

  trimmed.to_string()
}

fn resolve_sale_id(purchase: &GumroadPurchase) -> String {
  if let Some(sale_id) = &purchase.sale_id {
    let sale_id = sale_id.trim();
    if !sale_id.is_empty() {
      return sale_id.to_string();
    }
  }

  if let Some(id) = &purchase.id {
    let id = id.trim();
    if !id.is_empty() {
      return id.to_string();
    }
  }

  "".to_string()
}

#[tauri::command]
pub async fn verify_gumroad_license(
  params: VerifyGumroadLicenseParams,
) -> Result<VerifyGumroadLicenseResult, String> {
  let product_id = params.product_id.trim().to_string();
  let license_key = params.license_key.trim().to_string();
  let api_base = normalize_api_base(&params.api_base);

  if product_id.is_empty() {
    return Ok(
      VerifyGumroadLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "Gumroad product id is missing.".to_string(),
        status: Some(400),
      }
      .into(),
    );
  }

  if license_key.is_empty() {
    return Ok(
      VerifyGumroadLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "License key is required.".to_string(),
        status: Some(400),
      }
      .into(),
    );
  }

  let endpoint = format!("{}/v2/licenses/verify", api_base);
  let increment_uses_count = params.increment_uses_count.unwrap_or(false);

  let body = vec![
    ("product_id", product_id),
    ("license_key", license_key),
    (
      "increment_uses_count",
      if increment_uses_count {
        "true".to_string()
      } else {
        "false".to_string()
      },
    ),
  ];

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
        VerifyGumroadLicenseFailure {
          ok: false,
          reason: "network".to_string(),
          message: "Could not reach Gumroad license API.".to_string(),
          status: None,
        }
        .into(),
      );
    }
  };

  let status = response.status().as_u16();
  let payload = response
    .json::<GumroadLicenseVerifyResponse>()
    .await
    .unwrap_or_default();

  if status >= 400 || payload.success != Some(true) || payload.purchase.is_none() {
    return Ok(
      VerifyGumroadLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: payload
          .message
          .unwrap_or_else(|| "License key is invalid for this product.".to_string()),
        status: Some(status),
      }
      .into(),
    );
  }

  let purchase = payload.purchase.unwrap_or_default();
  if purchase.refunded.unwrap_or(false)
    || purchase.disputed.unwrap_or(false)
    || purchase.chargebacked.unwrap_or(false)
  {
    return Ok(
      VerifyGumroadLicenseFailure {
        ok: false,
        reason: "revoked".to_string(),
        message:
          "License access is unavailable because purchase is refunded or disputed.".to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  let sale_id = resolve_sale_id(&purchase);
  if sale_id.is_empty() {
    return Ok(
      VerifyGumroadLicenseFailure {
        ok: false,
        reason: "invalid".to_string(),
        message: "Gumroad verification did not include a valid sale id.".to_string(),
        status: Some(status),
      }
      .into(),
    );
  }

  Ok(
    VerifyGumroadLicenseSuccess {
      ok: true,
      purchase,
      sale_id,
    }
    .into(),
  )
}

impl From<VerifyGumroadLicenseSuccess> for VerifyGumroadLicenseResult {
  fn from(value: VerifyGumroadLicenseSuccess) -> Self {
    VerifyGumroadLicenseResult::Success(value)
  }
}

impl From<VerifyGumroadLicenseFailure> for VerifyGumroadLicenseResult {
  fn from(value: VerifyGumroadLicenseFailure) -> Self {
    VerifyGumroadLicenseResult::Failure(value)
  }
}
