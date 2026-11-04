package stripeclient

import (
	"log"
	"strings"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/client"
)

type Client struct {
	sc        *client.API
	secretKey string
}

func New(secretKey string) *Client {
	secretKey = strings.TrimSpace(secretKey)
	if secretKey == "" {
		log.Println("[Stripe] Warning: STRIPE_SECRET_KEY not set.")
	}
	stripe.Key = secretKey
	sc := client.New(secretKey, nil)
	return &Client{
		sc:        sc,
		secretKey: secretKey,
	}
}

// CreateCheckoutSession creates a Checkout Session for one-time payments or subscriptions
func (c *Client) CreateCheckoutSession(successURL, cancelURL string, amountCents int64, currency, description string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(currency),
					UnitAmount: stripe.Int64(amountCents),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String("Koliance AgentCard Deposit / Service"),
						Description: stripe.String(description),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
	}

	return c.sc.CheckoutSessions.New(params)
}

// CreateCustomer creates a customer object in Stripe
func (c *Client) CreateCustomer(email, name, walletAddress string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(name),
		Metadata: map[string]string{
			"wallet_address": walletAddress,
			"platform":       "koliance",
		},
	}
	return c.sc.Customers.New(params)
}

// CreateInvoice generates a standard invoice for an enterprise or agent user
func (c *Client) CreateInvoice(customerID string) (*stripe.Invoice, error) {
	params := &stripe.InvoiceParams{
		Customer: stripe.String(customerID),
		AutoAdvance: stripe.Bool(true),
		CollectionMethod: stripe.String(string(stripe.InvoiceCollectionMethodSendInvoice)),
		DaysUntilDue: stripe.Int64(30),
	}
	return c.sc.Invoices.New(params)
}

// CreateDepositCheckoutSession creates a Checkout Session specifically for micro-deposits,
// supporting Alipay, WeChat Pay, and credit/debit cards.
func (c *Client) CreateDepositCheckoutSession(successURL, cancelURL string, amountCents int64, currency, description, walletAddress string, paymentMethods []string) (*stripe.CheckoutSession, error) {
	if c.secretKey == "" {
		// Mock fallback for testing or deployments without live Stripe credentials
		return &stripe.CheckoutSession{
			ID:  "cs_mock_" + walletAddress[:min(8, len(walletAddress))],
			URL: "https://checkout.stripe.com/c/pay/cs_mock_deposit",
		}, nil
	}

	params := &stripe.CheckoutSessionParams{
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		Metadata: map[string]string{
			"wallet_address": walletAddress,
			"deposit_type":   "inference_vault",
		},
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String(currency),
					UnitAmount: stripe.Int64(amountCents),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String("Koliance Inference Vault Recharge"),
						Description: stripe.String(description),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
	}

	if len(paymentMethods) > 0 {
		params.PaymentMethodTypes = stripe.StringSlice(paymentMethods)
		hasWeChat := false
		for _, m := range paymentMethods {
			if m == "wechat_pay" {
				hasWeChat = true
				break
			}
		}
		if hasWeChat {
			params.PaymentMethodOptions = &stripe.CheckoutSessionPaymentMethodOptionsParams{
				WeChatPay: &stripe.CheckoutSessionPaymentMethodOptionsWeChatPayParams{
					Client: stripe.String("web"),
				},
			}
		}
	}

	return c.sc.CheckoutSessions.New(params)
}

// CreateSetupIntent creates a SetupIntent for off-session card authorization and auto-recharge.
func (c *Client) CreateSetupIntent(customerID string) (*stripe.SetupIntent, error) {
	if c.secretKey == "" {
		return &stripe.SetupIntent{
			ID:           "seti_mock_setup_intent",
			ClientSecret: "seti_mock_setup_intent_secret_abc123",
			Status:       "requires_payment_method",
		}, nil
	}

	params := &stripe.SetupIntentParams{
		Customer:           stripe.String(customerID),
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Usage:              stripe.String(string(stripe.SetupIntentUsageOffSession)),
	}
	return c.sc.SetupIntents.New(params)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

