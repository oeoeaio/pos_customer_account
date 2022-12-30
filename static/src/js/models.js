odoo.define('pos.customer.account.models', function (require) {
    "use strict";

    var models = require('point_of_sale.models');
    const { Gui } = require('point_of_sale.Gui');
    const { posbus } = require('point_of_sale.utils');

    // Add account balance to the partner field list
    models.load_fields('res.partner', ['account_balance']);

    // At POS startup, find the account payment method and account payment product id if they exist
    models.load_models({
        model: 'ir.model.data',
        fields: ['res_id','name','model'],
        domain: [['name','in',['pos_account_payment_method','account_payment_product']]],
        loaded: function(self,data){
            for (var i=0;i<data.length;i++){
                if (data[i].name == 'account_payment_product' && data[i].model == 'product.product'){
                    self.db.account_payment_product_id = data[i].res_id;
                }
                else if (data[i].name == 'pos_account_payment_method' && data[i].model == 'pos.payment.method'){
                    console.log(data)
                    self.db.account_payment_method_id = data[i].res_id;
                }
            }
        },
    });

    // Add get and set methods for customer credit to order model
    // Basically using the exact approach used for tips
    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        set_credit: function(credit){
            var credit_product = this.pos.db.get_product_by_id(this.pos.db.account_payment_product_id);
            var lines = this.get_orderlines();
            if (credit_product) {
              for (var i = 0; i < lines.length; i++) {
                  if (lines[i].get_product() === credit_product) {
                      lines[i].set_unit_price(credit);
                      return;
                  }
              }
              this.add_product(credit_product, {quantity: 1, price: credit });
            }

        },
        get_credit: function() {
            var credit_product = this.pos.db.get_product_by_id(this.pos.db.account_payment_product_id);
            var lines = this.get_orderlines();
            if (!credit_product) {
                return 0;
            } else {
                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].get_product() === credit_product) {
                        return lines[i].get_unit_price();
                    }
                }
                return 0;
            }
        },
        add_paymentline: async function(payment_method) {
            var account_payment_method_id = this.pos.db.account_payment_method_id;
            if (account_payment_method_id != payment_method.id) {
              _super_order.add_paymentline.apply(this, arguments);
              return;
            }
            var client = this.get_client();

            if (!client) {
              return await Gui.showPopup('ErrorPopup', {
                  title: 'Oops!',
                  body: 'You cannot pay on account when no customer is selected.'
              });
            }

            if (this.get_credit() > 0) {
              return await Gui.showPopup('ErrorPopup', {
                  title: 'Oops!',
                  body: 'You cannot pay on Account when account credit is being purchased. Please remove the account payment item from the order before paying on Account.'
              });
            }
            this.assert_editable();
            var newPaymentline = new models.Paymentline({},{order: this, payment_method:payment_method, pos: this.pos});
            var balance = client.account_balance;
            var due = this.get_due();
            var toPay = (balance > 0 ? Math.min(balance,due) : due);
            newPaymentline.set_amount( toPay );
            this.paymentlines.add(newPaymentline);
            this.select_paymentline(newPaymentline);
            posbus.trigger('account-balance-updated');
            return newPaymentline;
        },
        remove_paymentline: async function(line) {
            _super_order.remove_paymentline.apply(this, arguments);

            var account_payment_method_id = this.pos.db.account_payment_method_id;
            if (account_payment_method_id == line.payment_method.id) {
                posbus.trigger('account-balance-updated');
            }
        },
        account_payment_total: function() {
          let account_payment_method_id = this.pos.db.account_payment_method_id;
          return this.paymentlines.filter(function(paymentLine){
            return paymentLine.payment_method.id == account_payment_method_id;
          }).reduce((function(sum, paymentLine) {
            return sum + paymentLine.get_amount();
          }), 0);
        },
    });
});
