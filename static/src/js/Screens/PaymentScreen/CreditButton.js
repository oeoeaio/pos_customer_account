odoo.define('pos_customer_account.CreditButton', function(require) {
    'use strict';

    const { debounce } = owl.utils;
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useAutofocus } = require('web.custom_hooks');
    const { useState } = owl.hooks;
    const { parse } = require('web.field_utils');

    class CreditButton extends PosComponent {
        constructor() {
            super(...arguments);

            this.state = useState({
              label: 'Add Credit',
              highlight: false,
              disabled: true,
            });

            var order = this.env.pos.get_order();
            if (order) { this.setLabel() }
        }
        setLabel() {
            var client = this.env.pos.get_client();
            if (!client) return;

            this.state.disabled = false;
            var balance = client.account_balance;
            var order  = this.env.pos.get_order();
            var credit = order.get_credit();
            if (credit === 0 && balance < 0){
              this.state.label = "Pay Debt (" + this.env.pos.format_currency(-balance) + ")";
              this.state.highlight = true;
            }
            else if (credit > 0) {
              this.state.label = "Paying: " + this.env.pos.format_currency(credit)
            }
            this.updateBalance(balance);
        }
        async clickCredit() {
            var client = this.env.pos.get_client();
            if (!client) { return; }

            var accountPaymentMethodId = this.env.pos.db.account_payment_method_id;
            if (accountPaymentMethodId) {
              var tendered = this.accountPaymentTotal(accountPaymentMethodId);

              if (tendered > 0) {
                return await this.showPopup('ErrorPopup', {
                    title: 'Oops!',
                    body: 'You cannot pay for account credit using the Account payment method. Please pay with only Card or Cash if you wish to pay off or add credit to this account.'
                });
              }
            }

            var self    = this;
            var order   = this.env.pos.get_order();
            var credit  = order.get_credit();
            var balance = client.account_balance;
            var change  = order.get_change();
            var value   = credit;

            if (value === 0 && balance < 0){
              value = -balance;
            }

            if (value === 0 && change > 0  ) {
                value = change;
            }

            const { confirmed, payload: newValue } = await this.showPopup('NumberPopup', {
                startingValue: value,
                isInputSelected: true,
                title: credit ? 'Change Credit' : 'Add Credit',
            });
            if (confirmed) {
                order.set_credit(parse.float(newValue));
                this.setLabel();
                // TODO: work out whether we need to trigger these
                // self.paymentScreen.order_changes();
                // self.paymentScreen.render_paymentlines();
            }
        }
        accountPaymentTotal(paymentMethodId){
          var order = this.env.pos.get_order();
          return order.paymentlines.filter(function(paymentLine){
            return paymentLine.payment_method.id == paymentMethodId;
          }).reduce((function(sum, paymentLine) {
            return sum + paymentLine.get_amount();
          }), 0);
        }
        updateBalance(balance) {
            let accountPaymentMethodId = this.env.pos.db.account_payment_method_id;
            if (!accountPaymentMethodId) return;
            var tendered = this.accountPaymentTotal(accountPaymentMethodId);
            let paymentMethod = this.env.pos.payment_methods_by_id[accountPaymentMethodId];
            let paymentMethodElements = Array.from(document.querySelectorAll('.paymentmethod'))
            let methodElement = paymentMethodElements.find(el => el.textContent === paymentMethod.name);
            if (!methodElement) return;
            let balanceElement = methodElement.querySelector('div.balance');
            if (!balanceElement) {
              balanceElement = document.createElement('div');
              balanceElement.className = 'balance';
              methodElement.appendChild(balanceElement);
            }
            balanceElement.classList.toggle('credit', balance-tendered >= 0)
            balanceElement.classList.toggle('debt', balance-tendered < 0)
            balanceElement.innerHTML = "("+this.env.pos.format_currency(balance-tendered)+")"
            methodElement.classList.toggle('credit', tendered == 0 && balance > 0);
        }
    }

    CreditButton.template = 'CreditButton';

    Registries.Component.add(CreditButton);

    return CreditButton;
});
