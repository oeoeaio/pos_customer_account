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
        account_payment_total: function(journal_id){
          var order = this.pos.get_order();
          return order.paymentlines.filter(function(paymentLine){
            return paymentLine.cashregister.journal_id[0] == journal_id;
          }).reduce((function(sum, paymentLine) {
            return sum + paymentLine.get_amount();
          }), 0);
        },
        update_balance: function(balance){
            var jid = this.pos.db.account_journal_id;
            if (!jid) return;
            var tendered = this.account_payment_total(jid);
            var method = this.paymentScreen.$('.paymentmethod[data-id="' +jid+ '"]');
            var element = method.children('.balance');
            if (!element.length) element = $("<div class='balance'></div>").appendTo(method);
            element.toggleClass('credit', balance-tendered >= 0).toggleClass('debt', balance-tendered < 0)
            element.text("("+this.paymentScreen.format_currency(balance-tendered)+")")
            method.toggleClass('credit', tendered == 0);
        },
    });

    // Find the model request for partners (customers)
    // and add account balance to the field list
    var model_list = models.PosModel.prototype.models;
    for (var i=0;i < model_list.length;i++){
        if (model_list[i].model === 'res.partner'){
            model_list[i].fields.push('account_balance');
            break;
        }
    }

    // At POS startup, find the account journal and account payment product id if they exist
    models.load_models({
        model: 'ir.model.data',
        fields: ['res_id','name','model'],
        domain: [['name','in',['pos_customer_account_journal','account_payment_product']]],
        loaded: function(self,data){
            for (var i=0;i<data.length;i++){
                if (data[i].name == 'account_payment_product' && data[i].model == 'product.product'){
                    self.db.account_payment_product_id = data[i].res_id;
                }
                else if (data[i].name == 'pos_customer_account_journal' && data[i].model == 'account.journal'){
                    self.db.account_journal_id = data[i].res_id;
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
        add_paymentline: function(cashregister) {
            var jid = this.pos.db.account_journal_id;
            if (jid != cashregister.journal_id[0]) {
              _super_order.add_paymentline.apply(this,arguments);
              return;
            }
            var client = this.get_client();
            if (!client) return;
            this.assert_editable();
            var newPaymentline = new models.Paymentline({},{order: this, cashregister:cashregister, pos: this.pos});
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
