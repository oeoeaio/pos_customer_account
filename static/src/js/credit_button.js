odoo.define('pos.customer.account.credit_button', function (require) {
    "use strict";

    var BaseWidget = require('point_of_sale.BaseWidget');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var field_utils = require('web.field_utils');

    var CreditButton = BaseWidget.extend({
        template: 'CreditButton',
        init:function(parent,options){
            this._super(parent);
            this.paymentScreen = parent;
        },
        renderElement: function(){
            var self = this;
            this._super();
            this.$el.click(function(){
                self.click_credit();
            });
        },
        set_label: function(){
            this.label = 'Add Credit';
            this.highlight = false;
            this.disabled = true;

            var client = this.pos.get_client();
            if (!client) return;

            this.disabled = false;
            var balance = client.account_balance;
            var order  = this.pos.get_order();
            var credit = order.get_credit();
            if (credit === 0 && balance < 0){
              this.label = "Pay Debt (" + this.paymentScreen.format_currency(-balance) + ")";
              this.highlight = true;
            }
            else if (credit > 0) {
              this.label = "Paying: " + this.paymentScreen.format_currency(credit)
            }
            this.update_balance(balance);
        },
        click_credit: function(){
            var client = this.pos.get_client();
            if (!client) { return; }

            var account_payment_method_id = this.pos.db.account_payment_method_id;
            if (account_payment_method_id) {
              var tendered = this.account_payment_total(account_payment_method_id);

              if (tendered > 0) {
                return this.pos.gui.show_popup('alert', {
                  title: 'Oops!',
                  body: 'You cannot pay for account credit using the Account payment method. Please pay with only Card or Cash if you wish to pay off or add credit to this account.'
                });
              }
            }

            var self   = this;
            var order  = this.pos.get_order();
            var credit = order.get_credit();
            var balance = client.account_balance;
            var change = order.get_change();
            var value  = credit;

            if (value === 0 && balance < 0){
              value = -balance;
            }

            if (value === 0 && change > 0  ) {
                value = change;
            }

            this.gui.show_popup('number',{
                'title': credit ? 'Change Credit' : 'Add Credit',
                'value': self.format_currency_no_symbol(value),
                'confirm': function(value) {
                    order.set_credit(field_utils.parse.float(value));
                    self.paymentScreen.order_changes();
                    self.paymentScreen.render_paymentlines();
                },
            });
        },
        // called when the order is changed, used to update the label
        order_changes: function(){
            var self = this;
            var order = this.pos.get_order();
            if (!order) return;
            this.set_label();
            this.renderElement();
        },
        account_payment_total: function(payment_method){
          var order = this.pos.get_order();
          return order.paymentlines.filter(function(paymentLine){
            return paymentLine.payment_method == payment_method;
          }).reduce((function(sum, paymentLine) {
            return sum + paymentLine.get_amount();
          }), 0);
        },
        update_balance: function(balance){
            var account_payment_method_id = this.pos.db.account_payment_method_id;
            if (!account_payment_method_id) return;
            var tendered = this.account_payment_total(account_payment_method_id);
            var method = this.paymentScreen.$('.paymentmethod[data-id="' +account_payment_method_id+ '"]');
            var element = method.children('.balance');
            if (!element.length) element = $("<div class='balance'></div>").appendTo(method);
            element.toggleClass('credit', balance-tendered >= 0).toggleClass('debt', balance-tendered < 0)
            element.text("("+this.paymentScreen.format_currency(balance-tendered)+")")
            method.toggleClass('credit', tendered == 0 && balance > 0);
        },
    });

    // Find the model request for partners (customers)
    // and add account balance to the field list
    models.load_fields('res.partner', ['account_balance']);
    // var model_list = models.PosModel.prototype.models;
    // for (var i=0;i < model_list.length;i++){
    //     if (model_list[i].model === 'res.partner'){
    //         model_list[i].fields.push('account_balance');
    //         break;
    //     }
    // }

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
        add_paymentline: function(payment_method) {
            var account_payment_method_id = this.pos.db.account_payment_method_id;
            if (account_payment_method_id != payment_method.id) {
              _super_order.add_paymentline.apply(this,arguments);
              return;
            }
            var client = this.get_client();

            if (!client) {
              return this.pos.gui.show_popup('alert', {
                title: 'Oops!',
                body: 'You cannot pay on account when no customer is selected.'
              });
            }

            if (this.get_credit() > 0) {
              return this.pos.gui.show_popup('alert', {
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
        },
    });

    // Add the credit button to the payment screen
    screens.PaymentScreenWidget.include({
        renderElement: function(){
          this._super();
          this.credit_button = new CreditButton(this,{});
          this.credit_button.appendTo(this.$('.payment-buttons'));
        },
        show: function(){
            this.credit_button.order_changes();
            this._super();
        },
        render_paymentlines: function(){
            if (!this.credit_button) return;
            this.credit_button.order_changes();
            this._super();
        },
    });
});
