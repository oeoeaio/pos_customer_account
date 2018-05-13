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
                    self.order_changes();
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

    // At POS startup, load the account payment product if it exists
    models.load_models({
        model: 'ir.model.data',
        fields: ['res_id'],
        domain: ['&', ['name','=','account_payment_product'],['model', '=', 'product.product']],
        loaded: function(self,products){
            self.db.account_payment_product_id = products[0].res_id;
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
    });
});
