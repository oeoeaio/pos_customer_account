# pos_customer_account
Odoo module for managing credit/debits to customer accounts

# How it works

In older versions of this module there was a custom `Account` payment method included.

As of 15.0, Odoo ships with a `Customer Account` payment method. This payment method uses split transactions (which means that each order is recorded as a separate account move in the relevant journal) and requires the customer is identified (i.e. no annonymous purchases). I have re-written this module to use the transactions against the Trade Debtors account to document the state of customer accounts.

When a customer purchases something using the Customer Account payment method, this is recorded in the Point of Sale Journal as a debit against the `property_account_receivable` account of the relevant customer (`Trade Debtors` by default, no way to change this as far as I can tell and doing so for all customers would probably be impractical) and a credit against some POS sales account that I can't remember the name of. This behaviour works out of the box on vanilla odoo.

This module allows for credits to also be applied to the `Trade Debtors` (11200) account to represent an account payment (i.e. increasing credit or paying off debt). This can be done via the POS Payment Screen and is acheived using a special `Account Payment` product added to orders which is picked up during order processing.

Other adjustments can be made from the `Point of Sale > Customers > Account Transactions` view, which allows credits or debits to be applied outside of an order, either in bulk or individually. This is handy for things like adding credit to accounts after EFT transfers. In this scenario, a corresponding entry is recorded in the `Bank Account` account (whether debit or credit), rather than the POS sales account.
