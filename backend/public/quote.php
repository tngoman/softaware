<form action="<?= URL; ?>quotations/update" method="post" enctype="multipart/form-data" id="form"> 
<input type="hidden" name="token" value="<?= $_SESSION['token'] ?? '' ?>">
<input type="hidden" name="stage" id="stage">
    <div class="card">  
        <div class="card-body">  
            <div class="row">
                    <div class="col-md-6">
                        <div class="row">
                            <div class="col-md-12">
                                <div class="form-group input-group no-margin-bottom"> 
                                    <select id="quotation_contact" name="quotation_contact_id" class="form-control">
                                        <?php foreach($data['customers'] as $contact) { ?>
                                        <option value="<?=$contact['contact_id']?>" <?=$data['contact_id'] == $contact['contact_id'] ? "selected" :""?>><?=$contact['contact_name']?></option>
                                        <?php } ?>
                                    </select> 
                                </div>

                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text"><i class="fa fa-map"></i></span>
                                    </div>
                                    <input type="text" class="form-control"
                                        name="customer_name" placeholder="Physical Address"
                                        tabindex="1" value="<?=$data['contact_address']?>" readonly>
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text"><i class="fa fa-phone"></i></span>
                                    </div>
                                    <input type="text" class="form-control" placeholder="Contact Number" value="<?=$data['contact_phone']?>" readonly>
                                </div>

                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text"><i class="fa fa-user"></i></span>
                                    </div>
                                    <input type="text" class="form-control" placeholder="Contact Person" value="<?=$data['contact_person']?>" readonly>
                                </div>                                     
                            </div>

                            <div class="col-md-6"> 
                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text"><i class="fa fa-envelope"></i></span>
                                    </div>
                                    <input type="text" class="form-control" placeholder="Email Address" value="<?=$data['contact_email']?>" readonly>
                                </div>

                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text"><i class="fa fa-building"></i></span>
                                    </div>
                                    <input type="text" class="form-control" placeholder="VAT Number" value="<?=$data['contact_vat']?>" readonly>
                             
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 text-right">
                        <div class="row">

                            <div class="col-md-6">
                                <div class="form-group input-group no-margin-bottom">
                                    <div class="input-group-prepend">
                                        <span class="input-group-text">Quotation Number</span>
                                    </div>
                                    <input type="text" class="form-control" placeholder="Quote Number" name="quotation_id" value="<?=$data['quotation_id']?>">
                                </div> 

                                <div class="form-group input-group no-margin-bottom">       
                                        <input type="text" class="form-control required" value="<?=$data['quotation_date'] ?>"
                                            name="quotation_date" data-date-format="<?php echo 'Y-m-d' ?>" />
                                    <div class="input-group-append">
                                        <span class="input-group-text"><i class="far fa-calendar-check"></i></span>
                                    </div>
                                </div>  
                
                                <div class="form-group input-group no-margin-bottom">   
                                        <input type="text" class="form-control required" value="<?=$data['quotation_valid_until'] ?>"
                                            name="quotation_valid_until" data-date-format="<?php echo 'Y-m-d' ?>" />
                                    <div class="input-group-append">
                                        <span class="input-group-text"><i class="far fa-calendar-times"></i></span>
                                    </div>
                                </div> 

                                <div class="form-group input-group no-margin-bottom">                                   
                                    <select name="quotation_status" class="form-control margin-bottom" id="status">
                                        <option value="0">Draft</option>
                                        <option value="1" <?=$data['quotation_status'] == 1 ? 'selected' : ''?>>Sent</option>
                                        <?php if($data['quotation_status'] > 0) { ?>
                                        <option value="2" <?=$data['quotation_status'] == 2 ? 'selected' : ''?>>Accepted</option>
                                        <?php } ?>
                                    </select>
                                    <div class="input-group-append">
                                        <span class="input-group-text"><i class="fas fa-tags"></i></span>
                                    </div>
                                </div>  
                            </div>

                            <div class="col-md-6"> 
                                <textarea class="ckeditor form-control" rows="10" name="quotation_notes"><?=$data['quotation_notes'] != "" ? $data['quotation_notes'] : "Notes"?></textarea>             
                            </div>
                        </div> 

                    </div>
                </div>
        </div>
    </div>


    <div class="card pb-4"> 
        <div class="card-body">           
            <!-- / end client details section -->
            <table class="table table-bordered" id="quote_table">
                <thead>
                    <tr>
                        <th width="500">Item Name / Description</th>
                        <th>Unit Cost</th>
                        <th width="50">Vat</th>
                        <th>Unit Price</th>
                        <th width="100">Qty</th>
                        <th width="120">Discount</th>
                        <th>Sub Total</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $profit = 0;
                    if(count($data['items']) > 0) {
                        foreach($data['items'] as $item) { 
                            $profit += $item['item_profit']; ?>
                    <tr>
                        <td>
                            <div class="no-margin-bottom">
                                <div class="item_btn">
                                    <a href="#" class="btn btn-light btn-xs delete-row"><i class="fa fa-minus"></i></a>
                                    <a class="item-select btn btn-light btn-xs"><i class="fa fa-search"></i></a>
                                </div>
                                <div class="item_input">
                                    <input type="text" class="form-control item-input item_product no-margin-bottom" name="quote_product[]" placeholder="Enter item description" value="<?=$item['item_product']?>" required>
                                    <input type="hidden" class="item-input quote_supplier_id" name="item_supplier_id[]" value="<?=$item['item_supplier_id']?>"> 
                                </div>
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control item_cost calculate" name="product_cost[]" placeholder="0.00" value="<?=$item['item_cost']?>"> 
                            </div>
                        </td>

                        <td>
                            <div class="no-margin-bottom text-center"> 
                                <input type="checkbox" class="product_vat" <?=$item['item_vat'] > 0 ? "checked" : ""?>> 
                                <input type="hidden" name="product_vat[]" value="<?=$item['item_vat']?>">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control price quote_product_price required" name="product_price[]" placeholder="0.00" value="<?=round($item['item_price'], 2)?>"> 
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="form-group no-margin-bottom">
                                <input type="text" class="form-control calculate" name="product_qty[]" value="<?=$item['item_qty']?>" placeholder="0">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="form-group no-margin-bottom">
                                <input type="text" class="form-control calculate" name="product_discount[]" placeholder="Value / %" value="<?=$item['item_discount']?>">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control calculate-sub" name="product_sub[]" id="quotation_product_sub" value="<?=$item['item_subtotal']?>" placeholder="0.00">
                                <input type="hidden" class="calculate-total" id="product_profit" name="product_profit[]" value="<?=$item['item_profit']?>">
                            </div> 
                        </td>
                    </tr>
                    <?php }} else { ?>
                    <tr>
                        <td>
                            <div class="no-margin-bottom">
                                <div class="item_btn">
                                    <a href="#" class="btn btn-light btn-xs delete-row"><i class="fa fa-minus"></i></a>
                                    <a class="item-select btn btn-light btn-xs"><i class="fa fa-search"></i></a>
                                </div>
                                <div class="item_input">
                                    <input type="text" class="form-control item-input item_product no-margin-bottom" name="quote_product[]" placeholder="Enter item description" required>
                                    <input type="hidden" class="item-input quote_supplier_id" name="item_supplier_id[]"> 
                                </div>
                            </div>
                        </td>
                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control item_cost calculate" name="product_cost[]" placeholder="0.00"> 
                            </div>
                        </td>

                        <td>
                            <div class="no-margin-bottom text-center"> 
                                <input type="checkbox" class="product_vat"> 
                                <input type="hidden" name="product_vat[]">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control calculate quote_product_price required" name="product_price[]" placeholder="0.00"> 
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="form-group no-margin-bottom">
                                <input type="text" class="form-control calculate" name="product_qty[]" placeholder="0">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="form-group no-margin-bottom">
                                <input type="text" class="form-control calculate" name="product_discount[]" placeholder="Value / %">
                            </div>
                        </td>

                        <td class="text-right">
                            <div class="input-group no-margin-bottom">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">R</span>
                                </div>
                                <input type="text" class="form-control calculate-sub" name="product_sub[]" id="quotation_product_sub" placeholder="0.00">
                                <input type="hidden" class="calculate-total" id="product_profit" name="product_profit[]">
                            </div> 
                        </td>                        
                    </tr>
                    <?php } ?>
                </tbody>
            </table>
            <div id="quote_totals" class="padding-right row">
                <div class="col-md-8"> 
                    <div class="input-group form-group-sm textarea margin-bottom hidden" id="send_quote">
                        <hr>
                        <div class="row">
                            <div class="col-md-10">
                                <div class="form-group">
                                    <label class="form-label">Subject</label>
                                    <input type="text" name="quotation_subject" class="form-control" value="<?=$data['quotation_subject']?>">
                                </div> 
                            </div>
                            <div class="col-md-2">
                                <br/><br/>
                            <input type="submit" class="btn btn-danger btn-block pull-right" name="send" id="send_mail" value="Send" disabled> 
                            </div>
                        </div>

                        <textarea name="quotation_email" id="summernote" class="quotation_email">
                            <?=$data['quotation_email'] != "" && strip_tags(trim($data['quotation_email'])) != "" ? $data['quotation_email'] : 
                            "<p>Good day " . $data['contact_person'] . ",
                            </p>" .QUOTE_EMAIL_TEMPLATE.""?> 
                        </textarea>                        
                    </div>
                </div>

                <div class="col-md-4 no-padding-right">
                    <table class="table table-bordered">
                        <tbody>
                            <tr>
                                <td class="text-right"> 
                                    <strong>Sub Total:</strong>
                                </td>
                                <td>
                                    R<span class="quote-sub-total">0.00</span>
                                    <input type="hidden" name="quotation_subtotal" id="quote_subtotal" value="<?=$data['quotation_subtotal']?>">
                                </td>
                            </tr>

                            <tr>
                                <td class="text-right"> 
                                    <strong>Discount:</strong>
                                </td>
                                <td>
                                    R<span class="quote_discount">0.00</span>
                                    <input type="hidden" name="quotation_discount" id="quote_discount" value="<?=$data['quotation_subtotal']?>">
                                </td>
                            </tr>

                            <?php if (ENABLE_VAT == true) { ?>
                            <tr>
                                <td class="text-right"> 
                                    <strong>VAT:</strong><br>Remove <input type="checkbox" class="remove_vat">
                                </td>
                                <td>
                                    R<span class="quote-vat" data-enable-vat="<?php echo ENABLE_VAT ?>"
                                        data-vat-rate="<?php echo VAT_RATE ?>"
                                        data-vat-method="<?php echo "" ?>">0.00</span>
                                        <input type="hidden" name="quotation_vat" id="quote_vat" value="<?=$data['quotation_vat']?>">
                                </td>
                            </tr>
                            <?php } ?>

                            <tr>
                                <td class="text-right"> 
                                    <strong>Total:</strong>
                                </td>
                                <td>
                                    R<span class="quote-total">0.00</span>
                                    <input type="hidden" name="quotation_total" id="quote_total" value="<?=$data['quotation_total']?>">
                                </td>
                            </tr>

                            <tr>
                                <td class="text-right"> 
                                    <strong>Profit:</strong>
                                </td>
                                <td>
                                    R<span class="quote-profit"><?=$profit?></span>                                     
                                </td>
                            </tr>
                        </tbody>
                    </table> 

                    <div id="add">
                        <a href="#" class="btn btn-success btn-xs add-row"><i class="fa fa-plus"></i></a>
                    </div>
                    
                    <?php if(file_exists(QUOTES . "SoftAware-Quote" . $data['quotation_id'] . '.pdf')) { ?>
                        <a href="<?=URL?>quotes/SoftAware-Quote<?=$data['quotation_id']?>.pdf" target="_blank" class="btn btn-light">View</a>
                        <span class="btn btn-light" id="send">Send</span>

                    <?php } ?>

                    <input type="submit" class="btn btn-success pull-right" value="Save"
                    data-loading-text="Saving...">  
                    
                 
                    
                </div>
            </div> 

            <div id="insert" class="modal fade">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header"> 
                            <button class="btn btn-sm btn-warning pull-right" class="close" data-dismiss="modal" aria-label="Close">
                            <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <table class="table table-hover table-striped table-bordered select_rates" id="products"><thead><tr>
                                <th><input type="text" class="form-control" id="filters" onkeyup="productFilter()" placeholder="Start typing to filter the list... "></th>
                                <th>Unit</th>
                                <th>Price</th>
                                <th>Supplier</th>
                                </tr></thead><tbody>
                                    <?php foreach($data['pricing'] as $row) { ?> 
                                        <tr>
                                            <td><a href="#" class="rate-select" data-item = "<?=$row['pricing_item']?>" data-price = "<?=$row['pricing_price']?>"><?=$row['pricing_item']?></a></td> 
                                            <td><?=$row['pricing_unit']?></td> 
                                            <td><?=$row['pricing_price']?></td>
                                            <td><?=supplier_name($data['suppliers'], $row['pricing_note'])?></td>  
                                        </tr> 
                                    <?php } ?>
                                </tbody>
                            </table>
                        </div>
                    </div><!-- /.modal-content -->
                </div><!-- /.modal-dialog -->
            </div><!-- /.modal -->
        </div> 
    </div> 
</form>


<script>
    document.addEventListener('DOMContentLoaded', function() {
        var vat = parseInt($('.quote-vat').attr('data-vat-rate'));
        $(document).on('click', ".item-select", function(e) { 
            e.preventDefault;
            var product = $(this);        

            $('#insert').modal({ keyboard: false }).one('click', '.rate-select', function(e) {

                var item = $(this).attr('data-item');
                var price = $(this).attr('data-price').replace(",",".");  

                $(product).closest('tr').find('.item_product').val(item);
                $(product).closest('tr').find('.item_cost').val(price);             
                $('#insert').modal('hide');  
                updateTotals(product);
            });

            return false;
        });     

        // enable date pickers for due date and invoice date
        $('#quote_date, #quote_due_date').datetimepicker({
            showClose: false,
            viewMode: 'days',
            format: 'YYYY-MM-DD'
        }); 
        
        // remove product row
        $('#quote_table').on('click', ".delete-row", function(e) {
            e.preventDefault();
            $(this).closest('tr').remove();
            calculateTotal();
        });

        // add new product row on invoice
        var cloned = $('#quote_table tr:last').clone();
        
        $(".add-row").click(function(e) {
            e.preventDefault();
            cloned.clone().appendTo('#quote_table');
            var div = $('#quote_table'),
            height = div.height();
            div.animate({scrollTop: height}, 500);
            height += div.height();
        });
        
        calculateTotal();	 
        
        $('#quote_table').on('input', '.calculate', function () {
            updateTotals(this);
            calculateTotal();
        });

        $('#quote_table').on('change', '.product_vat', function () {
            updateTotals(this);
            calculateTotal();
        });

        $('#quote_table').on('input', '.price', function () { 
            updateTotals(this, this.value);
            calculateTotal();
        }); 

        $('#quote_totals').on('input', '.calculate', function () {
            calculateTotal();
        });

        $('#quote_product').on('input', '.calculate', function () {
            calculateTotal();
        });

        $('.remove_vat').on('change', function() {
            calculateTotal();
        }); 	

        function updateTotals(elem, price = null) {  
            var included = true;         
            var tr = $(elem).closest('tr'); 
            var qty = $('[name="product_qty[]"]', tr).val();
            var cost = parseFloat($('[name="product_cost[]"]', tr).val());
            var markup = parseInt('<?=MARKUP?>'); 
            var price = null == price ? cost + (cost/4) : price;
            var profit = price - cost; 

            if(!included)
            {
                $('[name="product_vat[]"]', tr).val((vat / 100) * cost);
                cost = ((vat / 100) * cost) + cost;           
            }
            else
            {
                $('[name="product_vat[]"]', tr).val(0.00);
            }
            
            price = (cost * 100)/(100 - markup);
            $('[name="product_price[]"]', tr).val(price.toFixed(2));
            
            var quantity = isNaN(qty) ? 0 : qty;
            if(quantity > 0)
            {
                isPercent = $('[name="product_discount[]"]', tr).val().length > 0 ? $('[name="product_discount[]"]', tr).val().indexOf('%') > -1 : 0,
                percent = $.trim($('[name="product_discount[]"]', tr).val().replace('%', '')),
                subtotal = parseInt(quantity) * parseFloat(price),
                tot = parseInt(quantity) * parseFloat(price);
                profit = profit * quantity;
                $('.calculate-sub', tr).val(formatted(tot));

                if(percent && $.isNumeric(percent) && percent !== 0) {
                    if(isPercent){
                        let disc_percent = (parseFloat(percent) / 100) * subtotal;
                        profit -= disc_percent;                    
                    } else {
                        
                        subtotal = subtotal - parseFloat(percent);
                        profit -= parseFloat(percent);
                    }
                } else {
                    $('[name="product_discount[]"]', tr).val('0.00');
                }

                $('.calculate-sub', tr).val(subtotal.toFixed(2));
            } 
            else
            {
                $('.calculate-sub', tr).val('0.00'); 
            }

            $('[name="product_profit[]"]', tr).val(profit);
        }


        function calculateTotal() {
            
            var grandTotal = 0,
                profit = 0,
                disc = 0,
                c_ship = parseInt($('.calculate.shipping').val()) || 0;

            $('#quote_table tbody tr').each(function() {
                var c_sbt = $('.calculate-sub', this).val().replaceAll(" ",""),            
                quantity = $('[name="product_qty[]"]', this).val(),
                price = $('[name="product_price[]"]', this).val().replaceAll(" ","") || 0,
                subtotal = parseInt(quantity) * parseFloat(price);
                profit += parseFloat($('[name="product_profit[]"]', this).val());

                isPercent = $('[name="product_discount[]"]', this).val().length > 0 ? $('[name="product_discount[]"]', this).val().indexOf('%') > -1 : 0,
                percent = $.trim($('[name="product_discount[]"]', this).val().replace('%', ''));

                if(percent && $.isNumeric(percent) && percent !== 0) {
                    if(isPercent) 
                    {
                        disc += ((parseFloat(percent) / 100) * subtotal); 
                    }
                    else {
                        disc += parseFloat(percent);
                    }
                }
                grandTotal += parseFloat(c_sbt);             
            });
    
            // VAT, DISCOUNT, SHIPPING, TOTAL, SUBTOTAL:
            var subT = parseFloat(grandTotal),
                finalTotal = parseFloat(grandTotal + c_ship);	    	

            $('.quote-sub-total').text(formatted(subT));
            $('#quote_subtotal').val(subT.toFixed(2));
            $('.quote_discount').text(formatted(disc));
            $('#quote_discount').val(disc.toFixed(2));
            $('.quote-profit').text(formatted(profit));

            var total_vat = (vat / 100) * finalTotal;
            var with_vat = finalTotal + ((vat / 100) * finalTotal);  
            if($('.remove_vat').prop('checked') == false) {
                $('.quote-vat').text(formatted(total_vat));
                $('#quote_vat').val(total_vat.toFixed(2));
                $('.quote-total').text(formatted(with_vat));
                 $('#quote_total').val(with_vat);
            } else {
                $('.quote-vat').text(formatted(total_vat));
                $('#quote_vat').val(total_vat.toFixed(2));
                $('.quote-total').text(formatted(with_vat)); 
                $('#quote_total').val(!isNaN(finalTotal) ? (finalTotal).toFixed(2) : '0.00');
            } 

            // remove vat
            if($('input.remove_vat').is(':checked')) {
                $('.quote-vat').text("0.00");
                $('#quote_vat').val("0.00");
                $('.quote-total').text(formatted(finalTotal));
                $('#quote_total').val(!isNaN(finalTotal) ? (finalTotal).toFixed(2) : '0.00');
            }
        }

        $('#send_mail').on('click', function() {
            $(this).val("Sending...");
        });

        $("#send").on('click', function() {
            $("#send_quote").slideDown(300);
            $('#send_mail').removeAttr('disabled');
        });  
        
        $("#status").on('change', function() {
            var selected = $(this).find("option:selected").val();
            if(selected == 2)
            {
                $('#stage').val('2');
                $('#form').submit();
            }
        });  
    }, false);

    function productFilter() { 
        var input, filter, table, tr, td, i;
        input = document.getElementById("filters");
        filter = input.value.toUpperCase();
        table = document.getElementById("products");
        tr = table.getElementsByTagName("tr");
        
        for (i = 0; i < tr.length; i++) {
            td = tr[i].getElementsByTagName("td")[0];
            if (td) {
                if (td.innerHTML.toUpperCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    }
</script>